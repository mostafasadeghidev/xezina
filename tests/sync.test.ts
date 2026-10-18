import { describe, expect, it } from 'vitest';
import { cloneState } from '../src/core/crdt';
import { emptyDeviceData, type DeviceData } from '../src/sync/local';
import { runSync, type SyncOptions } from '../src/sync/engine';
import { MassDeleteError } from '../src/sync/materialize';
import { deriveKey } from '../src/sync/codec';
import { MemoryStorage } from '../src/storage/types';
import { buildTree } from '../src/core/tree';
import { FakeBookmarks } from './fake-bookmarks';

class Device {
  data: DeviceData;
  bm: FakeBookmarks;
  backups = 0;
  constructor(
    readonly name: string,
    flavor: 'chromium' | 'firefox',
  ) {
    this.bm = new FakeBookmarks(flavor);
    this.data = emptyDeviceData(name);
  }
  sync(remote: MemoryStorage | null, opts: Omit<SyncOptions, 'remote'> = {}) {
    return runSync(
      {
        native: this.bm,
        load: async () => JSON.parse(JSON.stringify(this.data)),
        save: async (d) => {
          this.data = JSON.parse(JSON.stringify(d));
        },
        backup: async () => {
          this.backups++;
        },
        device: async () => ({ name: this.name, browser: this.bm.flavor }),
      },
      { remote, ...opts },
    );
  }
}

async function settle(remote: MemoryStorage, ...devices: Device[]) {
  for (let i = 0; i < 2; i++) for (const d of devices) await d.sync(remote);
}

describe('local scan', () => {
  it('records every bookmark and folder', async () => {
    const a = new Device('a', 'chromium');
    await a.bm.seed(a.bm.toolbar, ['https://a.com', { folder: 'Work', items: ['https://b.com', 'https://c.com'] }]);
    await a.sync(null);
    const tree = buildTree(a.data.state);
    expect([...tree.byId.values()].filter((n) => n.kind === 'bookmark')).toHaveLength(3);
    const titles = tree.roots.root_toolbar.children.map((c) => c.title);
    expect(titles).toEqual(['a.com', 'Work']);
  });

  it('a second scan without edits changes nothing', async () => {
    const a = new Device('a', 'chromium');
    await a.bm.seed(a.bm.toolbar, ['https://a.com', 'https://b.com']);
    await a.sync(null);
    const before = JSON.stringify(a.data.state);
    const r = await a.sync(null);
    expect(r.localChanges).toBe(0);
    expect(JSON.stringify(a.data.state)).toBe(before);
  });
});

describe('two browsers', () => {
  it('copies bookmarks from Chrome to Firefox and back', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://a.com', { folder: 'Dev', items: ['https://gh.com', { folder: 'Deep', items: ['https://x.io'] }] }]);
    await a.bm.seed(a.bm.other, ['https://other.com']);
    await settle(remote, a, b);
    expect(await b.bm.shape()).toMatchObject({
      toolbar: (await a.bm.shape()).toolbar,
      other: (await a.bm.shape()).other,
    });

    await b.bm.seed(b.bm.toolbar, ['https://from-ff.com']);
    await settle(remote, a, b);
    expect((await a.bm.shape()).toolbar).toEqual((await b.bm.shape()).toolbar);
  });

  it('does not duplicate bookmarks both browsers already have', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://a.com', { folder: 'Dev', items: ['https://gh.com'] }]);
    await b.bm.seed(b.bm.toolbar, ['https://a.com', { folder: 'Dev', items: ['https://gh.com', 'https://only-ff.com'] }]);
    await a.sync(null); // used locally before sync was set up
    await b.sync(null);
    await settle(remote, a, b);
    const shape = await a.bm.shape();
    expect(shape.toolbar).toEqual(['https://a.com', { Dev: ['https://gh.com', 'https://only-ff.com'] }]);
    expect((await b.bm.shape()).toolbar).toEqual(shape.toolbar);
  });

  it('merges concurrent edits to different fields', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://a.com', { folder: 'F', items: [] }]);
    await settle(remote, a, b);

    // Chrome renames, Firefox moves the same bookmark into F.
    await a.bm.update(a.bm.byUrl('https://a.com'), { title: 'Renamed' });
    await b.bm.move(b.bm.byUrl('https://a.com'), { parentId: b.bm.byTitle('F') });
    await settle(remote, a, b);

    for (const d of [a, b]) {
      const id = d.bm.byUrl('https://a.com');
      const n = d.bm.nodes.get(id)!;
      expect(n.title).toBe('Renamed');
      expect(d.bm.nodes.get(n.parentId)!.title).toBe('F');
    }
  });

  it('propagates deletes and reorders', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://1.com', 'https://2.com', 'https://3.com', 'https://4.com']);
    await settle(remote, a, b);

    await b.bm.removeTree(b.bm.byUrl('https://2.com'));
    await b.bm.move(b.bm.byUrl('https://4.com'), { parentId: b.bm.toolbar, index: 0 });
    await settle(remote, a, b);
    expect((await a.bm.shape()).toolbar).toEqual(['https://4.com', 'https://1.com', 'https://3.com']);

    // Chrome moves down within the same folder (its off-by-one case).
    await a.bm.move(a.bm.byUrl('https://4.com'), { parentId: a.bm.toolbar, index: 3 });
    await settle(remote, a, b);
    expect((await b.bm.shape()).toolbar).toEqual(['https://1.com', 'https://3.com', 'https://4.com']);
  });

  it('keeps a bookmark added to a folder that was deleted elsewhere', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, [{ folder: 'F', items: ['https://old.com'] }]);
    await settle(remote, a, b);

    await a.bm.removeTree(a.bm.byTitle('F'));
    await a.sync(remote);
    await b.bm.create({ parentId: b.bm.byTitle('F'), title: 'new', url: 'https://new.com' });
    await settle(remote, b, a);

    // The folder comes back for the new bookmark; what was deleted stays deleted.
    expect((await a.bm.shape()).toolbar).toEqual([{ F: ['https://new.com'] }]);
    expect((await b.bm.shape()).toolbar).toEqual((await a.bm.shape()).toolbar);
  });

  it('breaks folder cycles from concurrent moves', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, [{ folder: 'X', items: [] }, { folder: 'Y', items: [] }]);
    await settle(remote, a, b);
    await a.bm.move(a.bm.byTitle('X'), { parentId: a.bm.byTitle('Y') });
    await b.bm.move(b.bm.byTitle('Y'), { parentId: b.bm.byTitle('X') });
    await settle(remote, a, b);
    const sa = await a.bm.shape();
    const sb = await b.bm.shape();
    expect([sa.toolbar, sa.other]).toEqual([sb.toolbar, sb.other]);
    expect(JSON.stringify(sa)).toContain('"X"');
    expect(JSON.stringify(sa)).toContain('"Y"');
  });

  it('keeps Firefox-only things (menu, separators) without breaking Chrome', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await b.bm.seed('menu________', ['https://menu.com']);
    await b.bm.seed(b.bm.toolbar, ['https://1.com', { sep: true }, 'https://2.com']);
    await settle(remote, b, a);

    // Chrome shows the menu in a stand-in folder and skips the separator.
    expect((await a.bm.shape()).other).toEqual([{ 'Bookmarks Menu': ['https://menu.com'] }]);
    expect((await a.bm.shape()).toolbar).toEqual(['https://1.com', 'https://2.com']);

    await a.bm.seed(a.bm.byTitle('Bookmarks Menu'), ['https://menu2.com']);
    await settle(remote, a, b);
    expect((await b.bm.shape()).menu).toEqual(['https://menu.com', 'https://menu2.com']);
    expect((await b.bm.shape()).toolbar).toEqual(['https://1.com', '---', 'https://2.com']);
  });

  it('skips URLs a browser refuses, without deleting them elsewhere', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['chrome://settings', 'https://ok.com']);
    await settle(remote, a, b);
    expect((await b.bm.shape()).toolbar).toEqual(['https://ok.com']);
    expect((await a.bm.shape()).toolbar).toEqual(['chrome://settings', 'https://ok.com']);
  });

  it('refuses to mass-delete unless allowed, and backs up first', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, Array.from({ length: 40 }, (_, i) => `https://s${i}.com`));
    await settle(remote, a, b);
    for (const id of [...a.bm.nodes.get('1')!.children!]) await a.bm.removeTree(id);
    await a.sync(remote);
    await expect(b.sync(remote)).rejects.toBeInstanceOf(MassDeleteError);
    const before = b.backups;
    await b.sync(remote, { allowMassDelete: true });
    expect((await b.bm.shape()).toolbar).toEqual([]);
    expect(b.backups).toBe(before + 1);
  });

  it('force push and force pull', async () => {
    const remote = new MemoryStorage();
    const a = new Device('chrome', 'chromium');
    const b = new Device('firefox', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://1.com', 'https://2.com']);
    await settle(remote, a, b);

    await b.bm.seed(b.bm.toolbar, ['https://b-only.com']);
    await a.bm.removeTree(a.bm.byUrl('https://1.com'));
    await b.sync(remote);
    await a.sync(remote, { mode: 'push' }); // Chrome's view wins
    await b.sync(remote);
    expect((await b.bm.shape()).toolbar).toEqual(['https://2.com']);

    await b.bm.seed(b.bm.toolbar, ['https://local-junk.com']);
    await b.sync(null);
    await b.sync(remote, { mode: 'pull' }); // cloud wins
    expect((await b.bm.shape()).toolbar).toEqual(['https://2.com']);
  });

  it('three devices converge', async () => {
    const remote = new MemoryStorage();
    const a = new Device('a', 'chromium');
    const b = new Device('b', 'firefox');
    const c = new Device('c', 'chromium');
    await a.bm.seed(a.bm.toolbar, ['https://a.com']);
    await b.bm.seed(b.bm.toolbar, ['https://b.com']);
    await c.bm.seed(c.bm.toolbar, ['https://c.com', 'https://a.com']);
    await settle(remote, a, b, c);
    const shape = (await a.bm.shape()).toolbar;
    expect((shape as string[]).sort()).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
    expect((await b.bm.shape()).toolbar).toEqual(shape);
    expect((await c.bm.shape()).toolbar).toEqual(shape);
  });

  it('syncs encrypted data and rejects a wrong passphrase', async () => {
    const remote = new MemoryStorage();
    const salt = new Uint8Array(16);
    const key = await deriveKey('correct horse', salt, 1000);
    const wrong = await deriveKey('wrong', salt, 1000);
    const a = new Device('a', 'chromium');
    const b = new Device('b', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://secret.com']);
    await a.sync(remote, { key });
    const raw = new TextDecoder().decode([...remote.files.values()][0].data);
    expect(raw).not.toContain('secret.com');
    await expect(b.sync(remote, { key: wrong })).rejects.toThrow(/passphrase/);
    await b.sync(remote, { key });
    expect((await b.bm.shape()).toolbar).toEqual(['https://secret.com']);
  });

  it('notes and tags survive the first-contact match', async () => {
    const remote = new MemoryStorage();
    const a = new Device('a', 'chromium');
    const b = new Device('b', 'firefox');
    await a.bm.seed(a.bm.toolbar, ['https://a.com']);
    await b.bm.seed(b.bm.toolbar, ['https://a.com']);
    await a.sync(remote);
    await b.sync(null);
    const id = Object.keys(b.data.map).find((k) => b.data.state[k]?.v.url === 'https://a.com')!;
    const st = cloneState(b.data.state);
    st[id].v.notes = 'my note';
    st[id].s.notes = '~'; // newest possible stamp
    b.data.state = st;
    await settle(remote, b, a);
    const rec = Object.values(a.data.state).find((r) => r.v.url === 'https://a.com' && !r.v.del)!;
    expect(rec.v.notes).toBe('my note');
    expect(Object.values(a.data.state).filter((r) => r.v.url === 'https://a.com' && !r.v.del)).toHaveLength(1);
  });
});
