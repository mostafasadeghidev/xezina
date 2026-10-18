/**
 * "Refresh info" and reading a page again after its address changes.
 * Needs a test build with page access:
 *   XEZINA_E2E=1 pnpm build && node scripts/e2e-refresh.mjs && pnpm build
 */
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT = path.resolve('.output/chrome-mv3');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
}
// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let version = 1;
const site = http.createServer((req, res) => {
  if (req.url.startsWith('/img')) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PNG);
  }
  const page = req.url.startsWith('/new') ? 'New page' : version === 1 ? 'First title' : 'Second title';
  const img = req.url.startsWith('/new') || version === 2 ? '' : '<meta property="og:image" content="/img.png">';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<html><head><title>${page}</title><meta name="description" content="About ${page}">${img}</head><body>${page}</body></html>`);
});
await new Promise((r) => site.listen(19882, r));
const SITE = 'http://localhost:19882/';

const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'xz-ref-')), {
  channel: 'msedge', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/manager.html#/library/all`);
await page.waitForSelector('h1');
const rec = async (u) =>
  page.evaluate(async (u) => {
    const req = indexedDB.open('xezina');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const all = await new Promise((r) => {
      const q = db.transaction('records').objectStore('records').getAll();
      q.onsuccess = () => r(q.result);
    });
    return all.find((x) => x.v.url === u && !x.v.del);
  }, u);
const msg = (m) => page.evaluate((m) => chrome.runtime.sendMessage(m), m);

try {
  await sw.evaluate((u) => chrome.bookmarks.create({ parentId: '1', title: 'x', url: u }), SITE);
  await sleep(1500);
  let r = await rec(SITE);
  let res = await msg({ type: 'refresh', id: r.id });
  assert(res.ok && res.data.status === 200, 'refresh reads the page');
  r = await rec(SITE);
  assert(r.v.siteTitle === 'First title' && r.v.desc === 'About First title', 'title and description stored');
  assert(r.v.img && r.v.imgSrc === 'og', 'preview image stored');
  assert(r.v.title === 'x', 'the browser title is untouched');

  version = 2; // the site changed: new title, no image
  res = await msg({ type: 'refresh', id: r.id });
  r = await rec(SITE);
  assert(r.v.siteTitle === 'Second title' && r.v.desc === 'About Second title', 'refresh replaces old information');
  assert(!r.v.img, 'an image the page no longer has is dropped');

  await msg({ type: 'edit', id: r.id, url: SITE + 'new' });
  await sleep(2500);
  r = await rec(SITE + 'new');
  assert(r?.v.siteTitle === 'New page', 'changing the address reads the new page automatically');
  const before = page.context().pages().length;
  const t0 = Date.now();
  res = await msg({ type: 'shoot', id: r.id });
  assert(res.ok, `screenshot taken in its own window (${res.ok ? '' : res.error})`);
  r = await rec(SITE + 'new');
  assert(r.v.imgSrc === 'shot' && r.v.img, 'the screenshot became the preview');
  await sleep(500);
  assert(page.context().pages().length === before, 'the window closed itself');
  console.log(`   took ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log('\nALL GOOD');
} finally {
  await ctx.close();
  site.close();
}
