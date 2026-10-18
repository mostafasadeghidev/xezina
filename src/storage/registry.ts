import { DropboxStorage, GoogleDriveStorage, OneDriveStorage, type OAuthStorageConfig } from './cloud';
import { GitHubStorage, type GitHubConfig } from './github';
import type { OAuthProvider, TokenSource } from './oauth';
import { S3Storage, type S3Config } from './s3';
import type { RemoteStorage } from './types';
import { WebDavStorage, type WebDavConfig } from './webdav';

export type RemoteConfig = WebDavConfig | S3Config | GitHubConfig | OAuthStorageConfig;
export type RemoteType = RemoteConfig['type'];

export const REMOTE_TYPES: RemoteType[] = ['gdrive', 'dropbox', 'onedrive', 'webdav', 's3', 'github'];

export function isOAuth(type: RemoteType): type is OAuthProvider {
  return type === 'dropbox' || type === 'gdrive' || type === 'onedrive';
}

export function createRemote(cfg: RemoteConfig, tokens?: TokenSource): RemoteStorage {
  switch (cfg.type) {
    case 'webdav':
      return new WebDavStorage(cfg);
    case 's3':
      return new S3Storage(cfg);
    case 'github':
      return new GitHubStorage(cfg);
    case 'dropbox':
      return new DropboxStorage(cfg, need(tokens));
    case 'gdrive':
      return new GoogleDriveStorage(cfg, need(tokens));
    case 'onedrive':
      return new OneDriveStorage(cfg, need(tokens));
  }
}

function need(t?: TokenSource): TokenSource {
  if (!t) throw new Error('Not signed in');
  return t;
}

/** Host-permission patterns a remote needs (requested at runtime). */
export function originsFor(cfg: RemoteConfig): string[] {
  try {
    if (cfg.type === 'webdav') return [new URL(cfg.url).origin + '/*'];
    if (cfg.type === 's3') {
      const u = new URL(cfg.endpoint.includes('://') ? cfg.endpoint : 'https://' + cfg.endpoint);
      return cfg.pathStyle ? [`${u.origin}/*`] : [`${u.protocol}//*.${u.host}/*`, `${u.origin}/*`];
    }
  } catch {
    return [];
  }
  return [];
}
