import { toBase64 } from '../sync/codec';
import { bytesOf, encodePath, joinPath, request } from './http';
import { RemoteError, type RemoteFile, type RemoteStorage } from './types';

export interface GitHubConfig {
  type: 'github';
  token: string;
  owner: string;
  repo: string;
  branch: string;
  /** Folder inside the repository. */
  dir: string;
}

const API = 'https://api.github.com';

function headers(token: string, accept = 'application/vnd.github+json') {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * Stores files in a (private) GitHub repository. Every upload is a commit, so
 * the repository history doubles as a full version history of your bookmarks.
 */
export class GitHubStorage implements RemoteStorage {
  readonly id: string;
  private shas = new Map<string, string>();

  constructor(private cfg: GitHubConfig) {
    this.id = `github:${cfg.owner}/${cfg.repo}/${cfg.branch}/${joinPath(cfg.dir)}`;
  }

  private url(path: string) {
    const full = joinPath(this.cfg.dir || 'xezina', path);
    return `${API}/repos/${encodeURIComponent(this.cfg.owner)}/${encodeURIComponent(this.cfg.repo)}/contents/${encodePath(full)}`;
  }

  private get ref() {
    return this.cfg.branch ? `?ref=${encodeURIComponent(this.cfg.branch)}` : '';
  }

  async list(dir: string): Promise<RemoteFile[]> {
    const res = await request(this.url(dir) + this.ref, { headers: headers(this.cfg.token), allow: [404] });
    if (res.status === 404) return [];
    const items = (await res.json()) as { type: string; name: string; sha: string; size: number }[];
    if (!Array.isArray(items)) return [];
    const out: RemoteFile[] = [];
    for (const it of items) {
      if (it.type !== 'file') continue;
      this.shas.set(joinPath(dir, it.name), it.sha);
      out.push({ name: it.name, etag: it.sha, size: it.size });
    }
    return out;
  }

  async get(path: string): Promise<Uint8Array | null> {
    const res = await request(this.url(path) + this.ref, {
      headers: headers(this.cfg.token, 'application/vnd.github.raw+json'),
      allow: [404],
    });
    if (res.status === 404) return null;
    return bytesOf(res);
  }

  private async sha(path: string): Promise<string | undefined> {
    const res = await request(this.url(path) + this.ref, { headers: headers(this.cfg.token), allow: [404] });
    if (res.status === 404) return undefined;
    const json = (await res.json()) as { sha?: string };
    return json.sha;
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    const content = toBase64(data);
    for (let attempt = 0; attempt < 3; attempt++) {
      const sha = attempt === 0 && this.shas.has(path) ? this.shas.get(path) : await this.sha(path);
      const res = await request(this.url(path), {
        method: 'PUT',
        headers: { ...headers(this.cfg.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Xezina: update ${path}`,
          content,
          ...(sha ? { sha } : {}),
          ...(this.cfg.branch ? { branch: this.cfg.branch } : {}),
        }),
        allow: [409, 422],
      });
      if (res.ok) {
        const json = (await res.json()) as { content?: { sha?: string } };
        if (json.content?.sha) this.shas.set(path, json.content.sha);
        return;
      }
      this.shas.delete(path);
    }
    throw new RemoteError('GitHub rejected the upload (the file changed at the same time); try again', 409);
  }

  async delete(path: string): Promise<void> {
    const sha = this.shas.get(path) ?? (await this.sha(path));
    if (!sha) return;
    await request(this.url(path), {
      method: 'DELETE',
      headers: { ...headers(this.cfg.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Xezina: delete ${path}`,
        sha,
        ...(this.cfg.branch ? { branch: this.cfg.branch } : {}),
      }),
      allow: [404, 409, 422],
    });
    this.shas.delete(path);
  }
}

/** The signed-in user's login. */
export async function githubUser(token: string): Promise<string> {
  const res = await request(`${API}/user`, { headers: headers(token) });
  return ((await res.json()) as { login: string }).login;
}

/** Creates a private repository for Xezina data unless it already exists. */
export async function ensureRepo(token: string, owner: string, repo: string): Promise<{ branch: string }> {
  const res = await request(`${API}/repos/${owner}/${repo}`, { headers: headers(token), allow: [404] });
  if (res.ok) {
    const json = (await res.json()) as { default_branch: string; private: boolean };
    return { branch: json.default_branch };
  }
  const created = await request(`${API}/user/repos`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: repo,
      private: true,
      auto_init: true,
      description: 'Xezina bookmark sync data (private)',
    }),
  });
  const json = (await created.json()) as { default_branch: string };
  return { branch: json.default_branch || 'main' };
}

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

/** GitHub device flow, step 1: get a code the user types at github.com/login/device. */
export async function githubDeviceStart(clientId: string): Promise<DeviceCode> {
  const res = await request('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope: 'repo' }),
  });
  return (await res.json()) as DeviceCode;
}

/** Step 2: wait until the user approves; resolves with an access token. */
export async function githubDevicePoll(clientId: string, code: DeviceCode, signal?: AbortSignal): Promise<string> {
  let interval = Math.max(code.interval, 5) * 1000;
  const deadline = Date.now() + code.expires_in * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    if (signal?.aborted) throw new Error('Cancelled');
    const res = await request('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        device_code: code.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const json = (await res.json()) as { access_token?: string; error?: string; interval?: number };
    if (json.access_token) return json.access_token;
    if (json.error === 'slow_down') interval = (json.interval ?? interval / 1000 + 5) * 1000;
    else if (json.error && json.error !== 'authorization_pending') throw new Error(json.error.replace(/_/g, ' '));
  }
  throw new Error('The code expired; try again');
}
