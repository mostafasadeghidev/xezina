import { AwsClient } from 'aws4fetch';
import { bytesOf, encodePath, joinPath, request, unescapeXml, xmlValue, xmlValues } from './http';
import { RemoteError, type RemoteFile, type RemoteStorage } from './types';

export interface S3Config {
  type: 's3';
  /** e.g. https://<account>.r2.cloudflarestorage.com, https://s3.ir-thr-at1.arvanstorage.ir */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Key prefix (folder) inside the bucket. */
  prefix: string;
  /** Path-style URLs (bucket in the path). Needed by MinIO and most self-hosted servers. */
  pathStyle: boolean;
}

/** Any S3-compatible object storage: Cloudflare R2, ArvanCloud, AWS, Backblaze B2, MinIO, Wasabi… */
export class S3Storage implements RemoteStorage {
  readonly id: string;
  private client: AwsClient;
  private prefix: string;
  private bucketUrl: string;

  constructor(cfg: S3Config) {
    this.client = new AwsClient({
      accessKeyId: cfg.accessKeyId.trim(),
      secretAccessKey: cfg.secretAccessKey.trim(),
      region: cfg.region.trim() || 'auto',
      service: 's3',
    });
    const endpoint = cfg.endpoint.trim().replace(/\/+$/, '');
    const u = new URL(endpoint.includes('://') ? endpoint : 'https://' + endpoint);
    this.bucketUrl = cfg.pathStyle
      ? `${u.protocol}//${u.host}/${encodeURIComponent(cfg.bucket)}`
      : `${u.protocol}//${cfg.bucket}.${u.host}`;
    this.prefix = joinPath(cfg.prefix || 'xezina');
    this.id = `s3:${u.host}/${cfg.bucket}/${this.prefix}`;
  }

  private key(path: string) {
    return joinPath(this.prefix, path);
  }

  private async send(url: string, init: RequestInit & { allow?: number[] } = {}) {
    const { allow, ...rest } = init;
    const signed = await this.client.sign(url, rest);
    return request(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: rest.body,
      allow,
    });
  }

  async list(dir: string): Promise<RemoteFile[]> {
    const prefix = this.key(dir) + '/';
    const out: RemoteFile[] = [];
    let token = '';
    do {
      const q = new URLSearchParams({ 'list-type': '2', prefix, delimiter: '/' });
      if (token) q.set('continuation-token', token);
      const res = await this.send(`${this.bucketUrl}/?${q}`, { method: 'GET' });
      const xml = await res.text();
      for (const c of xmlValues(xml, 'Contents')) {
        const key = unescapeXml(xmlValue(c, 'Key'));
        const name = key.slice(prefix.length);
        if (!name || name.includes('/')) continue;
        out.push({ name, etag: unescapeXml(xmlValue(c, 'ETag')).replace(/"/g, ''), size: Number(xmlValue(c, 'Size')) });
      }
      token = xmlValue(xml, 'IsTruncated') === 'true' ? unescapeXml(xmlValue(xml, 'NextContinuationToken')) : '';
    } while (token);
    return out;
  }

  async get(path: string): Promise<Uint8Array | null> {
    const res = await this.send(`${this.bucketUrl}/${encodePath(this.key(path))}`, { method: 'GET', allow: [404] });
    if (res.status === 404) return null;
    return bytesOf(res);
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    await this.send(`${this.bucketUrl}/${encodePath(this.key(path))}`, {
      method: 'PUT',
      body: data as BodyInit,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }

  async delete(path: string): Promise<void> {
    const res = await this.send(`${this.bucketUrl}/${encodePath(this.key(path))}`, { method: 'DELETE', allow: [404] });
    if (!res.ok && res.status !== 404 && res.status !== 204) throw new RemoteError('Delete failed', res.status);
  }
}
