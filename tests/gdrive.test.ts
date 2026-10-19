import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRIVE_FOLDER, GoogleDriveStorage } from '../src/storage/cloud';
import { emptyDeviceData } from '../src/sync/local';
import { runSync } from '../src/sync/engine';
import { FakeBookmarks } from './fake-bookmarks';

/** A tiny in-memory Google Drive (only what Xezina uses). */
function fakeDrive() {
  type F = { id: string; name: string; parent: string; folder: boolean; data: Uint8Array; created: number };
  const files = new Map<string, F>();
  let n = 0;
  const add = (f: Omit<F, 'id' | 'created'>) => {
    const id = 'id' + ++n;
    files.set(id, { ...f, id, created: n });
    return id;
  };
  const match = (q: string, f: F) => {
    const name = q.match(/name = '((?:[^'\\]|\\.)*)'/)?.[1];
    const parent = q.match(/'([^']+)' in parents/)?.[1];
    if (name !== undefined && f.name !== name.replace(/\\'/g, "'")) return false;
    if (parent && f.parent !== parent) return false;
    if (q.includes("mimeType = 'application/vnd.google-apps.folder'") && !f.folder) return false;
    if (q.includes("mimeType != 'application/vnd.google-apps.folder'") && f.folder) return false;
    return true;
  };
  const view = (f: F) => ({ id: f.id, name: f.name, md5Checksum: f.folder ? undefined : 'm' + f.data.join('.').length + ':' + f.data[0], size: String(f.data.length) });
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init.method ?? 'GET';
    const body = init.body as Uint8Array | string | undefined;
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q') ?? '';
      const list = [...files.values()].filter((f) => match(q, f)).sort((a, b) => a.created - b.created);
      return Response.json({ files: list.map(view) });
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(body as string);
      return Response.json({ id: add({ name: meta.name, parent: meta.parents[0], folder: true, data: new Uint8Array() }) });
    }
    const idm = url.pathname.match(/files\/([^/]+)$/);
    if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const raw = new TextDecoder('latin1').decode(body as Uint8Array);
      const meta = JSON.parse(raw.match(/\r\n\r\n(\{.*?\})\r\n/)![1]);
      const start = raw.indexOf('octet-stream\r\n\r\n') + 'octet-stream\r\n\r\n'.length;
      const end = raw.lastIndexOf('\r\n--');
      const data = (body as Uint8Array).slice(start, end);
      return Response.json({ id: add({ name: meta.name, parent: meta.parents[0], folder: false, data }) });
    }
    if (idm && url.pathname.startsWith('/upload/') && method === 'PATCH') {
      const f = files.get(idm[1]);
      if (!f) return new Response('', { status: 404 });
      f.data = (body as Uint8Array).slice();
      return Response.json({ id: f.id });
    }
    if (idm && method === 'GET') {
      const f = files.get(idm[1]);
      return f ? new Response(f.data.slice()) : new Response('', { status: 404 });
    }
    if (idm && method === 'DELETE') {
      files.delete(idm[1]);
      return new Response(null, { status: 204 });
    }
    return new Response('unexpected ' + method + ' ' + url.pathname, { status: 500 });
  });
  return files;
}

afterEach(() => vi.unstubAllGlobals());
const tokens = { get: async () => 'token' };

describe('Google Drive storage', () => {
  it('keeps everything in a visible "Xezina" folder with sub-folders', async () => {
    const files = fakeDrive();
    const s = new GoogleDriveStorage({ type: 'gdrive', connection: 'c1' }, tokens);
    expect(await s.list('devices')).toEqual([]);
    await s.put('meta.json', new Uint8Array([1]));
    await s.put('devices/a.xz', new Uint8Array([2, 3]));
    await s.put('devices/a.xz', new Uint8Array([4, 5, 6]));
    const all = [...files.values()];
    const root = all.find((f) => f.folder && f.name === DRIVE_FOLDER)!;
    expect(root.parent).toBe('root');
    const devices = all.find((f) => f.folder && f.name === 'devices')!;
    expect(devices.parent).toBe(root.id);
    expect(all.filter((f) => f.folder)).toHaveLength(2);
    expect(all.find((f) => f.name === 'meta.json')!.parent).toBe(root.id);
    expect((await s.list('devices')).map((f) => f.name)).toEqual(['a.xz']);
    expect([...(await s.get('devices/a.xz'))!]).toEqual([4, 5, 6]);
    // A second device (fresh caches) finds the same folder instead of making another.
    const s2 = new GoogleDriveStorage({ type: 'gdrive', connection: 'c2' }, tokens);
    await s2.put('devices/b.xz', new Uint8Array([9]));
    expect([...files.values()].filter((f) => f.folder && f.name === DRIVE_FOLDER)).toHaveLength(1);
    expect((await s2.list('devices')).map((f) => f.name).sort()).toEqual(['a.xz', 'b.xz']);
    await s2.delete('devices/a.xz');
    expect(await s.get('devices/a.xz')).toBeNull();
  });

  it('syncs two browsers through Google Drive', async () => {
    fakeDrive();
    const mk = (name: string, flavor: 'chromium' | 'firefox') => {
      const bm = new FakeBookmarks(flavor);
      let data = emptyDeviceData(name);
      const remote = new GoogleDriveStorage({ type: 'gdrive', connection: name }, tokens);
      const sync = () =>
        runSync(
          {
            native: bm,
            load: async () => structuredClone(data),
            save: async (d) => {
              data = structuredClone(d);
            },
            device: async () => ({ name, browser: flavor }),
          },
          { remote },
        );
      return { bm, sync };
    };
    const a = mk('chrome', 'chromium');
    const b = mk('edge', 'chromium');
    await a.bm.seed(a.bm.toolbar, ['https://x.com', { folder: 'کارها', items: ['https://y.ir'] }]);
    await a.sync();
    await b.sync();
    expect((await b.bm.shape()).toolbar).toEqual(['https://x.com', { کارها: ['https://y.ir'] }]);
  });
});
