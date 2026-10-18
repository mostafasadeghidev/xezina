import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { v2 as webdav } from 'webdav-server';
import { WebDavStorage } from '../src/storage/webdav';
import { emptyDeviceData } from '../src/sync/local';
import { runSync } from '../src/sync/engine';
import { FakeBookmarks } from './fake-bookmarks';

let server: webdav.WebDAVServer;
const PORT = 19876;

beforeAll(async () => {
  const users = new webdav.SimpleUserManager();
  const user = users.addUser('me', 'secret', false);
  const privileges = new webdav.SimplePathPrivilegeManager();
  privileges.setRights(user, '/', ['all']);
  server = new webdav.WebDAVServer({
    port: PORT,
    httpAuthentication: new webdav.HTTPBasicAuthentication(users, 'test'),
    privilegeManager: privileges,
  });
  await new Promise<void>((r) => server.start(() => r()));
});

afterAll(async () => {
  await new Promise<void>((r) => server.stop(() => r()));
});

const cfg = { type: 'webdav' as const, url: `http://localhost:${PORT}/`, username: 'me', password: 'secret', folder: 'Sync/Xezina' };

describe('WebDAV storage', () => {
  it('creates nested folders and round-trips files', async () => {
    const s = new WebDavStorage(cfg);
    expect(await s.list('devices')).toEqual([]);
    expect(await s.get('devices/x.xz')).toBeNull();
    await s.put('devices/x.xz', new Uint8Array([1, 2, 3]));
    await s.put('devices/y é.xz', new Uint8Array([4]));
    const files = await s.list('devices');
    expect(files.map((f) => f.name).sort()).toEqual(['x.xz', 'y é.xz']);
    expect([...(await s.get('devices/x.xz'))!]).toEqual([1, 2, 3]);
    const before = files.find((f) => f.name === 'x.xz')!.etag;
    await s.put('devices/x.xz', new Uint8Array([9, 9, 9, 9]));
    const after = (await s.list('devices')).find((f) => f.name === 'x.xz')!.etag;
    expect(after).not.toBe(before);
    await s.delete('devices/x.xz');
    expect(await s.get('devices/x.xz')).toBeNull();
  });

  it('rejects a wrong password with a clear message', async () => {
    const s = new WebDavStorage({ ...cfg, password: 'nope' });
    await expect(s.list('devices')).rejects.toThrow(/401/);
  });

  it('syncs two browsers through a WebDAV server', async () => {
    const remote = new WebDavStorage({ ...cfg, folder: 'e2e' });
    const mk = (name: string, flavor: 'chromium' | 'firefox') => {
      const bm = new FakeBookmarks(flavor);
      let data = emptyDeviceData(name);
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
    const a = mk('a', 'chromium');
    const b = mk('b', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://x.com', { folder: 'پوشه', items: ['https://y.ir'] }]);
    await a.sync();
    await b.sync();
    expect((await b.bm.shape()).toolbar).toEqual(['https://x.com', { پوشه: ['https://y.ir'] }]);
  });
});
