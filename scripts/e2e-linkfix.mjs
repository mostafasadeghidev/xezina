/**
 * Broken links grouped by fix, with suggested addresses.
 *   XEZINA_E2E=1 pnpm build && node scripts/e2e-linkfix.mjs && pnpm build
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

// A site where some pages are gone and one moved.
const shop = http.createServer((req, res) => {
  const html = (t) => `<html><head><title>${t}</title></head><body>${t}</body></html>`;
  if (req.url === '/old-guide') {
    res.writeHead(301, { Location: '/guides/new-guide' });
    return res.end();
  }
  if (['/', '/shop/', '/guides/new-guide'].includes(req.url)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(html('ok ' + req.url));
  }
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(html('Not found'));
});
// A site that answers 404 to everything.
const empty = http.createServer((req, res) => {
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<html><head><title>404</title></head></html>');
});
await new Promise((r) => shop.listen(19884, r));
await new Promise((r) => empty.listen(19885, r));
const S = 'http://localhost:19884';
const E = 'http://localhost:19885';

const ctx = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'xz-fix-')), {
  channel: 'msedge', headless: true, viewport: { width: 1440, height: 900 }, ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
const records = () =>
  page.evaluate(async () => {
    const req = indexedDB.open('xezina');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    return new Promise((r) => {
      const q = db.transaction('records').objectStore('records').getAll();
      q.onsuccess = () => r(q.result.filter((x) => !x.v.del && x.v.url));
    });
  });

try {
  await sw.evaluate(
    async (urls) => {
      for (const [title, url] of urls) await chrome.bookmarks.create({ parentId: '1', title, url });
    },
    [
      ['Product 5', `${S}/shop/item-5`],
      ['Old guide', `${S}/old-guide`],
      ['Gone', `${E}/a/b`],
      ['Fine', `${S}/`],
    ],
  );
  await page.goto(`chrome-extension://${id}/manager.html#/library/all`);
  await page.waitForSelector('h1');
  await sleep(1500);
  const all = await records();
  await page.evaluate((ids) => chrome.runtime.sendMessage({ type: 'enrich', ids }), all.map((r) => r.id));
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const rs = await records();
    if (rs.every((r) => r.v.checkedAt)) break;
  }
  const by = Object.fromEntries((await records()).map((r) => [r.v.title, r.v]));
  assert(by['Product 5'].fixKind === 'parent' && by['Product 5'].fixUrl === `${S}/shop/`, 'missing product page → suggests the shop section');
  assert(by['Old guide'].fixKind === 'moved' && by['Old guide'].fixUrl === `${S}/guides/new-guide`, 'moved page → suggests the new address');
  assert(by['Gone'].status === 404 && !by['Gone'].fixUrl, 'site with nothing left → no suggestion');
  assert(!by['Fine'].fixUrl, 'working bookmark → nothing to fix');

  await page.goto(`chrome-extension://${id}/manager.html#/library/broken`);
  await page.waitForSelector('text=The page is gone, but the site works');
  assert((await page.getByText('Moved to a new address').count()) === 1, 'the moved page has its own group');
  assert((await page.getByText('Nothing found on the site').count()) === 1, 'the dead site has its own group');
  await page.screenshot({ path: path.join(SHOTS, 'f7-broken.png') });

  await page.locator('button', { hasText: 'Use this address' }).first().click();
  await sleep(2500);
  const urls = await sw.evaluate(async () => (await chrome.bookmarks.search({})).filter((b) => b.url).map((b) => b.url));
  assert(urls.includes(`${S}/shop/`) && !urls.includes(`${S}/shop/item-5`), '"Use this address" changes the bookmark');

  await page.locator('button', { hasText: /^Fix all/ }).click();
  await page.locator('.fixed button', { hasText: /^Fix all/ }).click();
  await sleep(3000);
  const urls2 = await sw.evaluate(async () => (await chrome.bookmarks.search({})).filter((b) => b.url).map((b) => b.url));
  assert(urls2.includes(`${S}/guides/new-guide`), '"Fix all" applies the remaining suggestion');
  console.log('\nALL GOOD');
} finally {
  await ctx.close();
  shop.close();
  empty.close();
}
