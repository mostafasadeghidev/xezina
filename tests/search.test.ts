import { describe, expect, it } from 'vitest';
import { Clock } from '../src/core/clock';
import { newRecord, setFields } from '../src/core/crdt';
import { highlightRanges } from '../src/core/fuzzy';
import { buildIndex, searchIds } from '../src/core/search';
import { buildTree } from '../src/core/tree';
import type { State } from '../src/core/types';

function library(items: [string, string, string?][]) {
  const c = new Clock('t');
  const st: State = {};
  items.forEach(([title, url, notes], i) => {
    const id = 'b' + i;
    st[id] = newRecord(id);
    setFields(st[id], { kind: 'bookmark', parent: 'root_toolbar', title, url, notes: notes ?? '', pos: 'a' + i }, c);
  });
  return buildIndex(buildTree(st));
}

const idx = library([
  ['Check host', 'https://check-host.net/'],
  ['GitHub', 'https://github.com/'],
  ['Hacker News', 'https://news.ycombinator.com/'],
  ['', 'https://www.figma.com/'],
  ['کتابخانهٔ ملی', 'https://nlai.ir/', 'منابع پژوهشی'],
  ['Chess', 'https://chess.com/'],
  ['Stack Overflow', 'https://stackoverflow.com/questions'],
]);
const first = (q: string) => searchIds(idx, q)[0];

describe('fuzzy search', () => {
  it('ignores separators and spacing', () => {
    expect(first('checkhost')).toBe('b0');
    expect(first('check host')).toBe('b0');
    expect(first('che host')).toBe('b0');
    expect(first('check-host.net')).toBe('b0');
  });
  it('tolerates a missing letter', () => {
    expect(first('chechost')).toBe('b0');
    expect(first('stackoverflw')).toBe('b6');
    expect(first('githb')).toBe('b1');
  });
  it('finds by the start of each word and by acronyms of the address', () => {
    expect(first('hack new')).toBe('b2');
    expect(first('ycomb')).toBe('b2');
    expect(first('stov')).toBe('b6');
  });
  it('finds empty-titled bookmarks by their address', () => {
    expect(first('figma')).toBe('b3');
  });
  it('handles Persian, ZWNJ and Arabic letter forms', () => {
    expect(first('كتابخانه')).toBe('b4');
    expect(first('کتاب ملی')).toBe('b4');
    expect(first('پژوهش')).toBe('b4');
  });
  it('ranks an exact word above a scattered match', () => {
    const ids = searchIds(idx, 'chess');
    expect(ids[0]).toBe('b5');
  });
});

describe('highlight', () => {
  const cut = (t: string, q: string) => highlightRanges(t, q).map(([a, b]) => t.slice(a, b));
  it('marks the matched letters in the original text', () => {
    expect(cut('check-host.net', 'checkhost')).toEqual(['check', 'host']);
    expect(cut('Hacker News', 'hack new')).toEqual(['Hack', 'New']);
    expect(cut('check-host.net', 'chechost')).toEqual(['chec', 'host']);
  });
  it('works across ZWNJ in Persian', () => {
    expect(cut('می‌خواهم', 'میخو').join('')).toBe('می‌خو');
  });
});

describe('speed', () => {
  it('searches 5000 bookmarks quickly', () => {
    const words = ['design', 'tools', 'news', 'learning', 'code', 'docs', 'video', 'shop', 'map', 'mail'];
    const big = library(
      Array.from({ length: 5000 }, (_, i) => [`${words[i % 10]} site ${i}`, `https://www.${words[(i * 7) % 10]}-${i}.example.com/page/${i}`, i % 3 ? '' : 'یادداشت درباره طراحی'] as [string, string, string]),
    );
    const t0 = performance.now();
    for (const q of ['desig', 'chechost', 'news site', 'طراحی', 'tools 4999']) searchIds(big, q, 50);
    const per = (performance.now() - t0) / 5;
    console.log(`search: ${per.toFixed(1)} ms per query on 5000 bookmarks`);
    expect(per).toBeLessThan(60);
  });
});
