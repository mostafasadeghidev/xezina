import { basicAuth, bytesOf, encodePath, joinPath, request, unescapeXml, xmlValue, xmlValues } from './http';
import type { RemoteFile, RemoteStorage } from './types';

export interface WebDavConfig {
  type: 'webdav';
  /** Base WebDAV URL, e.g. https://cloud.example.com/remote.php/dav/files/me/ */
  url: string;
  username: string;
  password: string;
  /** Folder inside the base URL. */
  folder: string;
}

/** Works with Nextcloud, ownCloud, Synology, QNAP, Koofr, Apache/nginx WebDAV, rclone serve… */
export class WebDavStorage implements RemoteStorage {
  readonly id: string;
  private root: string;
  private folder: string;
  private base: string;
  private auth: string;

  constructor(cfg: WebDavConfig) {
    const root = cfg.url.trim().replace(/\/?$/, '/');
    const folder = joinPath(cfg.folder || 'Xezina');
    this.root = root;
    this.folder = folder;
    this.base = root + encodePath(folder) + '/';
    this.auth = basicAuth(cfg.username, cfg.password);
    this.id = `webdav:${root}${folder}`;
  }

  private url(path: string) {
    return this.base + encodePath(joinPath(path));
  }

  async list(dir: string): Promise<RemoteFile[]> {
    const target = dir ? this.url(dir) + '/' : this.base;
    const res = await request(target, {
      method: 'PROPFIND',
      headers: { Authorization: this.auth, Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
      body:
        '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop>' +
        '<d:getetag/><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>',
      allow: [404],
    });
    if (res.status === 404) return [];
    const xml = await res.text();
    const out: RemoteFile[] = [];
    for (const block of xmlValues(xml, 'response')) {
      if (/<(?:[\w-]+:)?collection\b/i.test(block)) continue;
      const href = unescapeXml(xmlValue(block, 'href')).replace(/\/$/, '');
      const name = decodeURIComponent(href.slice(href.lastIndexOf('/') + 1));
      if (!name) continue;
      const etag = xmlValue(block, 'getetag').replace(/&quot;|"/g, '');
      const size = Number(xmlValue(block, 'getcontentlength')) || 0;
      out.push({ name, etag: etag || `${xmlValue(block, 'getlastmodified')}|${size}`, size });
    }
    return out;
  }

  async get(path: string): Promise<Uint8Array | null> {
    const res = await request(this.url(path), { headers: { Authorization: this.auth }, allow: [404] });
    if (res.status === 404) return null;
    return bytesOf(res);
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    const send = () =>
      request(this.url(path), {
        method: 'PUT',
        headers: { Authorization: this.auth, 'Content-Type': 'application/octet-stream' },
        body: data as BodyInit,
        allow: [404, 409],
      });
    let res = await send();
    if (res.status === 404 || res.status === 409) {
      await this.ensureDirs(path);
      res = await send();
      if (!res.ok) throw new Error(`Could not create folders on the WebDAV server (HTTP ${res.status})`);
    }
  }

  async delete(path: string): Promise<void> {
    await request(this.url(path), { method: 'DELETE', headers: { Authorization: this.auth }, allow: [404] });
  }

  private async ensureDirs(path: string) {
    // The folder may be several levels deep; create each level from the top.
    const parts = [...this.folder.split('/'), ...joinPath(path).split('/').slice(0, -1)];
    const dirs: string[] = [];
    let cur = this.root;
    for (const p of parts) dirs.push((cur = cur + encodeURIComponent(p) + '/'));
    for (const d of dirs) {
      await request(d, { method: 'MKCOL', headers: { Authorization: this.auth }, allow: [405, 409, 301, 302] });
    }
  }
}
