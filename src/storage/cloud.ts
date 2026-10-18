import { bytesOf, encodePath, joinPath, request, type RequestOptions } from './http';
import type { TokenSource } from './oauth';
import type { RemoteFile, RemoteStorage } from './types';

export interface OAuthStorageConfig {
  type: 'dropbox' | 'gdrive' | 'onedrive';
  /** Random id created when the account was connected. */
  connection: string;
  /** Optional account label shown in settings. */
  account?: string;
}

/** Runs a request with a bearer token, refreshing once on 401. */
async function authed(tokens: TokenSource, url: string, init: RequestOptions = {}): Promise<Response> {
  const run = async (force: boolean) =>
    request(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await tokens.get(force)}` },
      allow: [...(init.allow ?? []), 401],
    });
  let res = await run(false);
  if (res.status === 401) {
    res = await run(true);
    if (res.status === 401) throw new Error('Sign-in expired — reconnect the storage in Settings → Sync.');
  }
  return res;
}

/** Dropbox "App folder" (Apps/Xezina): the app cannot see anything else in your Dropbox. */
export class DropboxStorage implements RemoteStorage {
  readonly id: string;
  constructor(
    cfg: OAuthStorageConfig,
    private tokens: TokenSource,
  ) {
    this.id = `dropbox:${cfg.connection}`;
  }

  private arg(obj: unknown) {
    // Dropbox-API-Arg must be ASCII.
    return JSON.stringify(obj).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  }

  async list(dir: string): Promise<RemoteFile[]> {
    const out: RemoteFile[] = [];
    let res = await authed(this.tokens, 'https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dir ? '/' + joinPath(dir) : '', limit: 2000 }),
      allow: [409],
    });
    if (res.status === 409) return [];
    for (;;) {
      const json = (await res.json()) as {
        entries: { '.tag': string; name: string; rev: string; size: number }[];
        has_more: boolean;
        cursor: string;
      };
      for (const e of json.entries) if (e['.tag'] === 'file') out.push({ name: e.name, etag: e.rev, size: e.size });
      if (!json.has_more) break;
      res = await authed(this.tokens, 'https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor: json.cursor }),
      });
    }
    return out;
  }

  async get(path: string): Promise<Uint8Array | null> {
    const res = await authed(this.tokens, 'https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { 'Dropbox-API-Arg': this.arg({ path: '/' + joinPath(path) }) },
      allow: [409],
    });
    if (res.status === 409) return null;
    return bytesOf(res);
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    await authed(this.tokens, 'https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': this.arg({ path: '/' + joinPath(path), mode: 'overwrite', mute: true }),
      },
      body: data as BodyInit,
    });
  }

  async delete(path: string): Promise<void> {
    await authed(this.tokens, 'https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/' + joinPath(path) }),
      allow: [409],
    });
  }
}

interface DriveFile {
  id: string;
  name: string;
  md5Checksum?: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Google Drive's hidden app-data folder: invisible in Drive, only this app
 * can read it, and it needs no sensitive permission (no Google review).
 * Drive has no real paths there, so the path is the file name.
 */
export class GoogleDriveStorage implements RemoteStorage {
  readonly id: string;
  private ids = new Map<string, string>();
  constructor(
    cfg: OAuthStorageConfig,
    private tokens: TokenSource,
  ) {
    this.id = `gdrive:${cfg.connection}`;
  }

  private async query(q: string): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let page = '';
    do {
      const p = new URLSearchParams({
        spaces: 'appDataFolder',
        q,
        fields: 'nextPageToken,files(id,name,md5Checksum,modifiedTime,size)',
        pageSize: '1000',
      });
      if (page) p.set('pageToken', page);
      const res = await authed(this.tokens, `https://www.googleapis.com/drive/v3/files?${p}`);
      const json = (await res.json()) as { files: DriveFile[]; nextPageToken?: string };
      out.push(...json.files);
      page = json.nextPageToken ?? '';
    } while (page);
    for (const f of out) this.ids.set(f.name, f.id);
    return out;
  }

  private quote(s: string) {
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  async list(dir: string): Promise<RemoteFile[]> {
    const prefix = dir ? joinPath(dir) + '/' : '';
    // Drive's name search is word-based, so list everything and filter here.
    const files = await this.query('trashed = false');
    return files
      .filter((f) => f.name.startsWith(prefix) && !f.name.slice(prefix.length).includes('/'))
      .map((f) => ({
        name: f.name.slice(prefix.length),
        etag: f.md5Checksum || f.modifiedTime || f.id,
        size: Number(f.size) || 0,
      }));
  }

  private async idOf(path: string): Promise<string | undefined> {
    const name = joinPath(path);
    if (this.ids.has(name)) return this.ids.get(name);
    const found = await this.query(`name = ${this.quote(name)} and trashed = false`);
    return found[0]?.id;
  }

  async get(path: string): Promise<Uint8Array | null> {
    const id = await this.idOf(path);
    if (!id) return null;
    const res = await authed(this.tokens, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { allow: [404] });
    if (res.status === 404) {
      this.ids.delete(joinPath(path));
      return null;
    }
    return bytesOf(res);
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    const name = joinPath(path);
    const id = await this.idOf(name);
    if (id) {
      const res = await authed(this.tokens, `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data as BodyInit,
        allow: [404],
      });
      if (res.status !== 404) return;
      this.ids.delete(name);
    }
    const boundary = 'xezina' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + data.length + tail.length);
    body.set(head);
    body.set(data, head.length);
    body.set(tail, head.length + data.length);
    const res = await authed(this.tokens, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: body as BodyInit,
    });
    const json = (await res.json()) as { id: string };
    this.ids.set(name, json.id);
  }

  async delete(path: string): Promise<void> {
    const id = await this.idOf(path);
    if (!id) return;
    await authed(this.tokens, `https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE', allow: [404] });
    this.ids.delete(joinPath(path));
  }
}

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';

/** OneDrive "Apps/Xezina" folder; the app cannot see the rest of your OneDrive. */
export class OneDriveStorage implements RemoteStorage {
  readonly id: string;
  constructor(
    cfg: OAuthStorageConfig,
    private tokens: TokenSource,
  ) {
    this.id = `onedrive:${cfg.connection}`;
  }

  private item(path: string) {
    return `${GRAPH_ROOT}:/${encodePath(joinPath(path))}:`;
  }

  async list(dir: string): Promise<RemoteFile[]> {
    const out: RemoteFile[] = [];
    let url: string | undefined = (dir ? `${this.item(dir)}/children` : `${GRAPH_ROOT}/children`) + '?$top=1000&$select=name,eTag,size,file';
    while (url) {
      const res = await authed(this.tokens, url, { allow: [404] });
      if (res.status === 404) return [];
      const json = (await res.json()) as {
        value: { name: string; eTag: string; size: number; file?: unknown }[];
        '@odata.nextLink'?: string;
      };
      for (const f of json.value) if (f.file) out.push({ name: f.name, etag: f.eTag, size: f.size });
      url = json['@odata.nextLink'];
    }
    return out;
  }

  async get(path: string): Promise<Uint8Array | null> {
    const res = await authed(this.tokens, `${this.item(path)}/content`, { allow: [404] });
    if (res.status === 404) return null;
    return bytesOf(res);
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    if (data.length <= 4 * 1024 * 1024) {
      await authed(this.tokens, `${this.item(path)}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: data as BodyInit,
      });
      return;
    }
    // Large files go through an upload session in 5 MiB chunks.
    const res = await authed(this.tokens, `${this.item(path)}/createUploadSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    });
    const { uploadUrl } = (await res.json()) as { uploadUrl: string };
    const chunk = 5 * 1024 * 1024; // must be a multiple of 320 KiB
    for (let start = 0; start < data.length; start += chunk) {
      const end = Math.min(start + chunk, data.length);
      await request(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Range': `bytes ${start}-${end - 1}/${data.length}` },
        body: data.subarray(start, end) as BodyInit,
      });
    }
  }

  async delete(path: string): Promise<void> {
    await authed(this.tokens, this.item(path), { method: 'DELETE', allow: [404] });
  }
}
