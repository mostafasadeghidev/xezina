import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../src/storage/types';
import { previewFirstContact, runSync, type EngineDeps } from '../src/sync/engine';
import { emptyDeviceData } from '../src/sync/local';
import { FakeBookmarks } from './fake-bookmarks';

function browserOn(remote: MemoryStorage, name: string) {
  const bm = new FakeBookmarks('chromium');
  let data = emptyDeviceData(name);
  const deps: EngineDeps = {
    native: bm,
    load: async () => structuredClone(data),
    save: async (d) => {
      data = structuredClone(d);
    },
    device: async () => ({ name, browser: 'chromium' }),
  };
  return { bm, deps, sync: (mode?: 'normal' | 'pull' | 'push') => runSync(deps, { remote, mode }) };
}

describe('first contact choice', () => {
  it('asks only when both sides already have bookmarks', async () => {
    const remote = new MemoryStorage();
    const chrome = browserOn(remote, 'Chrome');
    await chrome.bm.seed(chrome.bm.toolbar, ['https://a.com', 'https://b.com']);
    // The storage is empty: nothing to decide.
    expect(await previewFirstContact(chrome.deps, remote, null)).toBeNull();
    await chrome.sync();

    const empty = browserOn(remote, 'Firefox');
    expect(await previewFirstContact(empty.deps, remote, null)).toBeNull();

    const edge = browserOn(remote, 'Edge');
    await edge.bm.seed(edge.bm.toolbar, ['https://c.com']);
    expect(await previewFirstContact(edge.deps, remote, null)).toEqual({ local: 1, remote: 2, devices: ['Chrome'] });

    // "Use the cloud copy": Edge ends up exactly like Chrome.
    await edge.sync('pull');
    expect((await edge.bm.shape()).toolbar).toEqual(['https://a.com', 'https://b.com']);
    expect(await previewFirstContact(edge.deps, remote, null)).toBeNull();
  });

  it('"use this browser" replaces what the other browsers have', async () => {
    const remote = new MemoryStorage();
    const chrome = browserOn(remote, 'Chrome');
    await chrome.bm.seed(chrome.bm.toolbar, ['https://a.com']);
    await chrome.sync();
    const edge = browserOn(remote, 'Edge');
    await edge.bm.seed(edge.bm.toolbar, ['https://c.com']);
    await edge.sync('push');
    await chrome.sync();
    expect((await chrome.bm.shape()).toolbar).toEqual(['https://c.com']);
  });
});
