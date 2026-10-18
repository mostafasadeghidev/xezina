import { describe, expect, it } from 'vitest';
import { emptyDeviceData, type DeviceData } from '../src/sync/local';
import { runSync } from '../src/sync/engine';
import { MemoryStorage } from '../src/storage/types';
import { FakeBookmarks } from './fake-bookmarks';

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

class Dev {
  data: DeviceData;
  bm: FakeBookmarks;
  constructor(name: string, flavor: 'chromium' | 'firefox') {
    this.bm = new FakeBookmarks(flavor);
    this.data = emptyDeviceData(name);
  }
  sync(remote: MemoryStorage) {
    return runSync(
      {
        native: this.bm,
        load: async () => structuredClone(this.data),
        save: async (d) => {
          this.data = structuredClone(d);
        },
        device: async () => ({ name: this.data.deviceId, browser: this.bm.flavor }),
      },
      { remote, allowMassDelete: true },
    );
  }
  /** Bookmarks bar + other, in a browser-neutral shape. */
  async view() {
    const s = await this.bm.shape();
    return JSON.stringify([s.toolbar, s.other]);
  }
}

async function randomEdit(d: Dev, r: () => number, n: number) {
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  for (let i = 0; i < n; i++) {
    const all = [...d.bm.nodes.values()].filter((x) => !['0', 'root________'].includes(x.id) && x.parentId !== '' && x.parentId !== 'root________' && x.parentId !== '0');
    const folders = [...d.bm.nodes.values()].filter((x) => x.children && x.id !== '0' && x.id !== 'root________' && x.id !== '3' && x.id !== 'mobile______' && x.id !== 'menu________');
    const op = r();
    if (op < 0.35 || all.length < 3) {
      const parent = pick(folders);
      if (r() < 0.25) await d.bm.create({ parentId: parent.id, title: `f${Math.floor(r() * 1e6)}` });
      else await d.bm.create({ parentId: parent.id, title: 't', url: `https://s${Math.floor(r() * 1e6)}.com`, index: Math.floor(r() * (parent.children!.length + 1)) });
    } else if (op < 0.5) {
      await d.bm.removeTree(pick(all).id);
    } else if (op < 0.75) {
      const node = pick(all);
      const target = pick(folders);
      // never move a folder into itself or its descendants
      let p: string | undefined = target.id;
      let bad = false;
      while (p) {
        if (p === node.id) bad = true;
        p = d.bm.nodes.get(p)?.parentId;
      }
      if (!bad) await d.bm.move(node.id, { parentId: target.id, index: Math.floor(r() * (target.children!.length + 1)) });
    } else {
      await d.bm.update(pick(all).id, { title: `r${Math.floor(r() * 1e6)}` });
    }
  }
}

describe('random concurrent edits', () => {
  for (const seed of Array.from({ length: 25 }, (_, i) => i + 1)) {
    it(`converges (seed ${seed})`, async () => {
      const r = rng(seed);
      const remote = new MemoryStorage();
      const devs = [new Dev('a', 'chromium'), new Dev('b', 'firefox'), new Dev('c', 'chromium')];
      for (let round = 0; round < 8; round++) {
        for (const d of devs) {
          await randomEdit(d, r, 8);
          if (r() < 0.7) await d.sync(remote);
        }
      }
      // Keep syncing until a full round changes nothing anywhere.
      let rounds = 0;
      for (;;) {
        const calls = devs.map((d) => d.bm.calls);
        const pushed = [];
        for (const d of devs) pushed.push((await d.sync(remote)).pushed);
        rounds++;
        if (!pushed.some(Boolean) && devs.every((d, i) => d.bm.calls === calls[i])) break;
        expect(rounds).toBeLessThan(8);
      }
      const views = await Promise.all(devs.map((d) => d.view()));
      expect(views[1]).toBe(views[0]);
      expect(views[2]).toBe(views[0]);
    });
  }
});
