/**
 * Browser test for: duplicates "select extras", the home page live search,
 * the new tab page, the reaction to the browser's star, and title handling.
 *   pnpm build && node scripts/e2e-features.mjs [screenshot-dir]
 */
import { chromium } from 'playwright-core';
import { mkdtempSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT = path.resolve('.output/chrome-mv3');
const SHOTS = path.resolve(process.argv[2] ?? '.output/e2e');
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
}

// A tiny site to bookmark.
const site = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><title>Lovely Recipes</title>
    <meta name="description" content="Weeknight dinners in thirty minutes"></head>
    <body style="background:#fde68a;font:40px sans-serif;padding:60px">Lovely Recipes</body></html>`);
});
await new Promise((r) => site.listen(19879, r));
const SITE = 'http://localhost:19879/';

const dir = mkdtempSync(path.join(tmpdir(), 'xz-feat-'));
const ctx = await chromium.launchPersistentContext(dir, {
  channel: process.env.E2E_CHANNEL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const url = (p, hash = '') => `chrome-extension://${id}/${p}${hash}`;

const records = (page) =>
  page.evaluate(async () => {
    const req = indexedDB.open('xezina');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    return new Promise((r) => {
      const q = db.transaction('records').objectStore('records').getAll();
      q.onsuccess = () => r(q.result);
    });
  });

try {
  console.log('1. duplicates: keep one of each');
  await sw.evaluate(async () => {
    const mk = (parentId, title, url) => chrome.bookmarks.create({ parentId, title, url });
    const f = await chrome.bookmarks.create({ parentId: '2', title: 'Old stuff' });
    await mk('1', 'Docs', 'https://developer.mozilla.org/');
    await mk(f.id, 'MDN again', 'https://developer.mozilla.org/');
    await mk('2', 'MDN 3', 'https://developer.mozilla.org');
    await mk('1', 'Figma', 'https://www.figma.com/');
    await mk(f.id, 'Figma copy', 'https://figma.com/');
    await mk('2', 'Unique', 'https://example.org/');
  });
  const page = await ctx.newPage();
  await page.goto(url('manager.html', '#/library/dups'));
  await page.waitForSelector('text=Select extras', { timeout: 15000 });
  await sleep(500);
  await page.locator('button', { hasText: 'Select extras' }).click();
  await sleep(300);
  const selectedText = await page.locator('text=/\\d+ selected/').first().textContent();
  assert(selectedText?.startsWith('3 selected'), `3 extras selected out of 5 copies (${selectedText})`);
  const kept = await page.getByText('Kept', { exact: true }).count();
  assert(kept === 2, 'one copy kept per site (2 groups)');
  await page.screenshot({ path: path.join(SHOTS, 'f1-duplicates.png') });
  page.once('dialog', (d) => d.accept());
  await page.locator('button', { hasText: 'Delete' }).last().click();
  await page.locator('button', { hasText: 'Delete' }).last().click(); // confirm dialog
  await sleep(1500);
  const urls = await sw.evaluate(async () => (await chrome.bookmarks.search({})).filter((b) => b.url).map((b) => b.url));
  assert(urls.filter((u) => u.includes('mozilla')).length === 1 && urls.filter((u) => u.includes('figma')).length === 1, 'deleting leaves exactly one of each');

  console.log('2. home page live search with preview');
  const recs = await records(page);
  const mdn = recs.find((r) => r.v.url?.includes('mozilla') && !r.v.del);
  await page.evaluate((id) => chrome.runtime.sendMessage({ type: 'meta', ids: [id], patch: { notes: 'Reference for HTML, CSS and JavaScript', tags: ['docs'] } }), mdn.id);
  await page.goto(url('manager.html', '#/home'));
  await page.waitForSelector('text=What are you looking for?');
  await page.keyboard.type('javascript');
  await sleep(400);
  const firstHit = await page.locator('[data-i="0"]').textContent();
  assert(/Docs|MDN/.test(firstHit ?? ''), `live suggestion found by note (${firstHit?.slice(0, 40)})`);
  assert((await page.locator('text=Reference for HTML, CSS and JavaScript').count()) >= 1, 'preview pane shows the note');
  await page.screenshot({ path: path.join(SHOTS, 'f2-home-search.png') });

  console.log('3. empty browser title stays empty; display name is Xezina-only');
  const nid = await sw.evaluate(async () => (await chrome.bookmarks.create({ parentId: '1', title: '', url: 'https://news.ycombinator.com/' })).id);
  await sleep(1500);
  let all = await records(page);
  const hn = all.find((r) => r.v.url === 'https://news.ycombinator.com/');
  await page.evaluate((id) => chrome.runtime.sendMessage({ type: 'meta', ids: [id], patch: { label: 'Hacker News' } }), hn.id);
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'sync' }));
  const nativeTitle = await sw.evaluate(async (nid) => (await chrome.bookmarks.get(nid))[0].title, nid);
  assert(nativeTitle === '', 'browser title is still empty after sync');
  all = await records(page);
  await page.goto(url('manager.html', '#/home'));
  await page.waitForSelector('text=What are you looking for?');
  await sleep(300);
  await page.locator('input').first().fill('hacker');
  await sleep(400);
  assert(((await page.locator('[data-i="0"]').textContent()) ?? '').includes('Hacker News'), 'display name is shown and searchable');

  console.log('4. reacting to the browser star');
  await sw.evaluate(() =>
    chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, afterStar: 'notify' } })),
  );
  const tab = await ctx.newPage();
  await tab.goto(SITE);
  await tab.bringToFront();
  await sleep(500);
  await sw.evaluate((u) => chrome.bookmarks.create({ parentId: '1', title: 'R', url: u }), SITE);
  await sleep(2500);
  const notes = await sw.evaluate(() => chrome.notifications.getAll());
  assert(Object.keys(notes).some((k) => k.startsWith('xz-saved:')), 'a "bookmark saved" notification was shown');
  all = await records(page);
  assert(all.some((r) => r.v.url === SITE && !r.v.del), 'starred page is in the library');

  console.log('5. new tab page');
  const nt = await ctx.newPage();
  await nt.goto(url('newtab.html'));
  await nt.waitForSelector('text=What are you looking for?', { timeout: 10000 });
  assert(true, 'new tab shows the Xezina home');
  await nt.screenshot({ path: path.join(SHOTS, 'f3-newtab.png') });
  await sw.evaluate(() =>
    chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, newTab: false } })),
  );
  await nt.goto(url('newtab.html')).catch(() => undefined); // it navigates away while loading
  await sleep(1500);
  console.log('   with the option off, new tab went to:', nt.url());
  assert(!nt.url().includes('newtab.html') || (await nt.locator('text=turned off').count()) > 0, 'turning it off hands the tab back (or explains how)');

  console.log('\nALL GOOD — screenshots in', SHOTS);
} finally {
  await ctx.close();
  site.close();
}
