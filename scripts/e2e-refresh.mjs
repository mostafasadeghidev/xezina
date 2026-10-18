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
  if (req.url.startsWith('/framed')) {
    // Like most big sites: refuses to be shown inside another page.
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "frame-ancestors 'none'",
    });
    return res.end('<html><head><title>Framed</title></head><body style="margin:0;height:100vh;background:rgb(0,0,220)"><h1 style="color:#fff">LIVE OK</h1></body></html>');
  }
  if (req.url.startsWith('/slow')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<html><head><title>Slow</title><style>
      body{margin:0;height:100vh;background:#444}
      @keyframes spin{to{transform:rotate(360deg)}}
      .s{width:200px;height:200px;margin:200px auto;border:20px solid #fff;border-top-color:#f00;border-radius:50%;animation:spin .6s linear infinite}
    </style></head><body><div class="s"></div>
    <script>setTimeout(()=>{document.body.innerHTML='';document.body.style.background='rgb(0,200,0)'},9000)</script></body></html>`);
  }
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
  await sw.evaluate((u) => chrome.bookmarks.create({ parentId: '1', title: 'slow', url: u }), SITE + 'slow');
  await sleep(1500);
  const slow = await rec(SITE + 'slow');
  const t1 = Date.now();
  res = await msg({ type: 'shoot', id: slow.id });
  const secs = Math.round((Date.now() - t1) / 1000);
  assert(res.ok && secs >= 10, `a slow page gets more time (${secs} s)`);
  const color = await page.evaluate(async (hash) => {
    const req = indexedDB.open('xezina');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const row = await new Promise((r) => {
      const q = db.transaction('blobs').objectStore('blobs').get(hash);
      q.onsuccess = () => r(q.result);
    });
    const bmp = await createImageBitmap(row.blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return [...g.getImageData(Math.floor(bmp.width / 2), Math.floor(bmp.height / 2), 1, 1).data].slice(0, 3);
  }, (await rec(SITE + 'slow')).v.img);
  assert(color[1] > 150 && color[0] < 80, `the picture shows the finished page, not the loading screen (rgb ${color.join(',')})`);
  await sw.evaluate((u) => chrome.bookmarks.create({ parentId: '1', title: 'Framed', url: u }), SITE + 'framed');
  await sleep(1500);
  await page.goto('about:blank');
  await page.goto(`chrome-extension://${id}/manager.html#/library/all`);
  await page.waitForSelector('h1');
  await page.locator('h3', { hasText: 'Framed' }).first().click();
  await page.locator('aside').getByText('Live view').click();
  await page.waitForSelector('iframe[title=live]');
  let frameText = '';
  for (let i = 0; i < 20 && !frameText.includes('LIVE OK'); i++) {
    await sleep(300);
    const f = page.frames().find((fr) => fr.url().includes('/framed'));
    frameText = f ? await f.locator('body').innerText().catch(() => '') : '';
  }
  assert(frameText.includes('LIVE OK'), 'a site that forbids framing shows live inside the preview box');
  await page.bringToFront(); // as in real use: the tab is in front of the user
  await sleep(500);
  await page.locator('aside').getByText('Use this view').click();
  let framed = await rec(SITE + 'framed');
  for (let i = 0; i < 16 && framed.v.imgSrc !== 'shot'; i++) {
    await sleep(500);
    framed = await rec(SITE + 'framed');
  }
  assert(framed.v.imgSrc === 'shot' && framed.v.img, '"Use this view" saves that view as the preview');
  const px = await page.evaluate(async (hash) => {
    const req = indexedDB.open('xezina');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const row = await new Promise((r) => {
      const q = db.transaction('blobs').objectStore('blobs').get(hash);
      q.onsuccess = () => r(q.result);
    });
    const bmp = await createImageBitmap(row.blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return [...g.getImageData(Math.floor(bmp.width * 0.7), Math.floor(bmp.height * 0.7), 1, 1).data].slice(0, 3);
  }, framed.v.img);
  assert(px[2] > 180 && px[0] < 60, `the picture is the site itself, cropped to the box (rgb ${px.join(',')})`);
  console.log('\nALL GOOD');
} finally {
  await ctx.close();
  site.close();
}
