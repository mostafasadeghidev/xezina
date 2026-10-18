import { describe, expect, it } from 'vitest';
import { Clock } from '../src/core/clock';
import { mergeState, newRecord, setField } from '../src/core/crdt';
import { reorderKeys, generateKeyBetween } from '../src/core/order';
import { foldText, normalizeUrl } from '../src/core/normalize';
import { buildIndex, searchIds } from '../src/core/search';
import { buildTree } from '../src/core/tree';
import type { State } from '../src/core/types';

describe('clock', () => {
  it('is monotonic and never behind what it observed', () => {
    let t = 1000;
    const c = new Clock('a', '', () => t);
    const s1 = c.now();
    const s2 = c.now();
    expect(s2 > s1).toBe(true);
    const far = new Clock('b', '', () => 5000).now();
    c.observe(far);
    expect(c.now() > far).toBe(true);
    t = 9000;
    expect(c.now() > far).toBe(true);
  });
});

describe('crdt merge', () => {
  it('is order independent', () => {
    const ca = new Clock('a');
    const cb = new Clock('b');
    const a: State = { x: newRecord('x') };
    const b: State = { x: newRecord('x') };
    setField(a.x, 'title', 'A', ca);
    setField(b.x, 'title', 'B', cb);
    setField(b.x, 'notes', 'n', cb);
    const ab: State = JSON.parse(JSON.stringify(a));
    mergeState(ab, b);
    const ba: State = JSON.parse(JSON.stringify(b));
    mergeState(ba, a);
    expect(ab).toEqual(ba);
    expect(ab.x.v.notes).toBe('n');
  });
});

describe('order keys', () => {
  it('re-keys only what moved', () => {
    const k: string[] = [];
    let prev: string | null = null;
    for (let i = 0; i < 5; i++) k.push((prev = generateKeyBetween(prev, null)));
    // move last to front
    const order = [k[4], k[0], k[1], k[2], k[3]];
    const upd = reorderKeys(order);
    expect(upd.size).toBe(1);
    const final = order.map((key, i) => upd.get(i) ?? key);
    expect([...final].sort()).toEqual(final);
  });
});

describe('text', () => {
  it('folds Persian and Arabic forms', () => {
    expect(foldText('مي‌خواهم كتاب ۱۲۳')).toBe('میخواهم کتاب 123');
  });
  it('normalizes urls for duplicate detection', () => {
    expect(normalizeUrl('https://www.Example.com/a/?utm_source=x&b=2')).toBe(normalizeUrl('http://example.com/a?b=2'));
  });
});

describe('search', () => {
  it('finds by notes, tags, host and Persian text', () => {
    const c = new Clock('a');
    const st: State = {};
    const mk = (id: string, title: string, url: string, notes = '', tags: string[] = []) => {
      st[id] = newRecord(id);
      setField(st[id], 'kind', 'bookmark', c);
      setField(st[id], 'parent', 'root_toolbar', c);
      setField(st[id], 'title', title, c);
      setField(st[id], 'url', url, c);
      setField(st[id], 'notes', notes, c);
      setField(st[id], 'tags', tags, c);
    };
    mk('1', 'Figma', 'https://figma.com', 'ابزار طراحی رابط کاربری', ['design']);
    mk('2', 'GitHub', 'https://github.com/x', '', ['code']);
    mk('3', 'كتابخانه', 'https://lib.ir');
    const idx = buildIndex(buildTree(st));
    expect(searchIds(idx, 'طراحی')).toEqual(['1']);
    expect(searchIds(idx, 'design')).toEqual(['1']);
    expect(searchIds(idx, 'github')[0]).toBe('2');
    expect(searchIds(idx, 'کتابخانه')).toEqual(['3']);
    expect(searchIds(idx, 'figm')).toContain('1');
  });
});

describe('link health', () => {
  it('never calls extension-store pages broken', async () => {
    const { linkHealth, isProtectedPage } = await import('../src/enrich/metadata');
    const store = 'https://chromewebstore.google.com/detail/idm-integration-module/ngpampappnmepgilojfohadhhmbhlaek';
    expect(isProtectedPage(store)).toBe(true);
    expect(isProtectedPage('https://microsoftedge.microsoft.com/addons/detail/x')).toBe(true);
    expect(isProtectedPage('https://google.com/')).toBe(false);
    expect(linkHealth(0, Date.now(), store)).toBe('blocked');
    expect(linkHealth(404, Date.now(), 'https://gone.example/')).toBe('broken');
    expect(linkHealth(0, Date.now(), 'https://filtered.example/')).toBe('blocked');
    expect(linkHealth(503, Date.now(), 'https://busy.example/')).toBe('blocked');
    expect(linkHealth(500, Date.now(), 'https://busy.example/')).toBe('blocked');
    expect(linkHealth(200, Date.now(), 'https://ok.example/')).toBe('ok');
  });
});
