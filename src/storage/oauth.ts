import { browser } from 'wxt/browser';

export type OAuthProvider = 'dropbox' | 'gdrive' | 'onedrive';

export interface OAuthTokens {
  access: string;
  refresh?: string;
  /** ms epoch; 0 = unknown. */
  expiresAt: number;
}

/** Hands out a valid access token, refreshing when needed. */
export interface TokenSource {
  get(forceRefresh?: boolean): Promise<string>;
}

/** Client ids baked in at build time (see .env.example); users can override them in settings. */
export const BUILT_IN_CLIENT_IDS: Record<OAuthProvider | 'github', string> = {
  dropbox: import.meta.env.WXT_DROPBOX_CLIENT_ID ?? '',
  gdrive: import.meta.env.WXT_GDRIVE_CLIENT_ID ?? '',
  onedrive: import.meta.env.WXT_ONEDRIVE_CLIENT_ID ?? '',
  github: import.meta.env.WXT_GITHUB_CLIENT_ID ?? '',
};

interface ProviderDef {
  authUrl: string;
  tokenUrl?: string;
  scope?: string;
  extra?: Record<string, string>;
  /** Google: no client secret allowed in an extension, so use the token flow. */
  implicit?: boolean;
}

const PROVIDERS: Record<OAuthProvider, ProviderDef> = {
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    extra: { token_access_type: 'offline' },
  },
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite.AppFolder offline_access',
  },
  gdrive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    // Only files Xezina created itself (its "Xezina" folder); no Google review needed.
    scope: 'https://www.googleapis.com/auth/drive.file',
    implicit: true,
  },
};

export function redirectUrl(): string {
  return browser.identity.getRedirectURL();
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge: base64url(digest) };
}

function params(url: string): URLSearchParams {
  const u = new URL(url);
  const p = new URLSearchParams(u.search);
  for (const [k, v] of new URLSearchParams(u.hash.replace(/^#/, ''))) p.set(k, v);
  return p;
}

async function tokenRequest(def: ProviderDef, body: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch(def.tokenUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Sign-in failed (HTTP ${res.status})`);
  }
  return {
    access: json.access_token,
    refresh: json.refresh_token ?? body.refresh_token,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 - 60_000 : 0,
  };
}

/** Opens the provider's sign-in page and returns tokens. */
export async function signIn(provider: OAuthProvider, clientId: string, interactive = true): Promise<OAuthTokens> {
  if (!clientId) throw new Error('No client id configured for this provider (see Settings → Advanced).');
  const def = PROVIDERS[provider];
  const redirect = redirectUrl();
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, state, ...def.extra });
  if (def.scope) q.set('scope', def.scope);
  let verifier = '';
  if (def.implicit) {
    q.set('response_type', 'token');
    if (!interactive) q.set('prompt', 'none');
  } else {
    const p = await pkce();
    verifier = p.verifier;
    q.set('response_type', 'code');
    q.set('code_challenge', p.challenge);
    q.set('code_challenge_method', 'S256');
    if (!interactive && provider === 'onedrive') q.set('prompt', 'none');
  }
  const result = await browser.identity.launchWebAuthFlow({ url: `${def.authUrl}?${q}`, interactive });
  if (!result) throw new Error('Sign-in was cancelled');
  const p = params(result);
  if (p.get('error')) throw new Error(p.get('error_description') || p.get('error') || 'Sign-in failed');
  if (p.get('state') !== state) throw new Error('Sign-in failed (state mismatch)');
  if (def.implicit) {
    const access = p.get('access_token');
    if (!access) throw new Error('Sign-in failed');
    const expires = Number(p.get('expires_in') || 3600);
    return { access, expiresAt: Date.now() + expires * 1000 - 60_000 };
  }
  return tokenRequest(def, {
    grant_type: 'authorization_code',
    code: p.get('code') ?? '',
    client_id: clientId,
    redirect_uri: redirect,
    code_verifier: verifier,
  });
}

/** Gets a fresh access token without user interaction when possible. */
export async function refreshTokens(provider: OAuthProvider, clientId: string, tokens: OAuthTokens): Promise<OAuthTokens> {
  const def = PROVIDERS[provider];
  if (tokens.refresh && def.tokenUrl) {
    try {
      return await tokenRequest(def, {
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh,
        client_id: clientId,
        ...(def.scope ? { scope: def.scope } : {}),
      });
    } catch (e) {
      if (provider !== 'onedrive') throw e;
    }
  }
  // Google (and OneDrive when its short-lived refresh token expired): silent re-sign-in.
  return signIn(provider, clientId, false);
}

/** A TokenSource that refreshes and persists tokens through `save`. */
export function tokenSource(
  provider: OAuthProvider,
  clientId: string,
  initial: OAuthTokens,
  save: (t: OAuthTokens) => Promise<void>,
): TokenSource {
  let tokens = initial;
  let pending: Promise<OAuthTokens> | null = null;
  return {
    async get(force = false) {
      if (!force && tokens.access && (!tokens.expiresAt || tokens.expiresAt > Date.now())) return tokens.access;
      if (!pending) {
        pending = refreshTokens(provider, clientId, tokens)
          .then(async (t) => {
            tokens = t;
            await save(t);
            return t;
          })
          .finally(() => {
            pending = null;
          });
      }
      try {
        return (await pending).access;
      } catch {
        throw new Error('Sign-in expired — reconnect the storage in Settings → Sync.');
      }
    },
  };
}
