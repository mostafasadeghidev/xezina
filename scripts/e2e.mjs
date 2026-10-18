/**
 * End-to-end smoke test: two independent browser profiles with the built
 * extension sync through a local WebDAV server.
 *
 *   pnpm build && node scripts/e2e.mjs [screenshot-dir]
 */
import { chromium } from 'playwright-core';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import webdavPkg from 'webdav-server';

const { v2: webdav } = webdavPkg;
const EXT = path.resolve('.output/chrome-mv3');
const SHOTS = path.resolve(process.argv[2] ?? '.output/e2e');
mkdirSync(SHOTS, { recursive: true });
const PORT = 19877;

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
}

async function startDav() {
  const users = new webdav.SimpleUserManager();
  const user = users.addUser('me', 'pw', false);
  const priv = new webdav.SimplePathPrivilegeManager();
  priv.setRights(user, '/', ['all']);
  const server = new webdav.WebDAVServer({
    port: PORT,
    httpAuthentication: new webdav.HTTPBasicAuthentication(users, 'e2e'),
    privilegeManager: priv,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Depth, Content-Type',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, PROPFIND, MKCOL, OPTIONS',
      'Access-Control-Expose-Headers': 'ETag',
    },
  });
  // CORS preflight must succeed without credentials.
  server.beforeRequest((ctx, next) => {
    if (ctx.request.method === 'OPTIONS') {
      ctx.response.setHeader('Access-Control-Allow-Origin', '*');
      ctx.response.setHeader('Access-Control-Allow-Headers', 'Authorization, Depth, Content-Type');
      ctx.response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, PROPFIND, MKCOL, OPTIONS');
      ctx.response.writeHead(204);
      ctx.response.end();
      return;
    }
    next();
  });
  await new Promise((r) => server.start(() => r()));
  return server;
}

async function launch(name) {
  const dir = mkdtempSync(path.join(tmpdir(), `xz-${name}-`));
  const ctx = await chromium.launchPersistentContext(dir, {
    // Edge still honours --load-extension (branded Chrome no longer does).
    channel: process.env.E2E_CHANNEL ?? 'msedge',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  return { ctx, sw, id, name };
}

/** Sends a runtime message from an extension page and returns the reply. */
async function msg(page, m) {
  const reply = await page.evaluate((m) => chrome.runtime.sendMessage(m), m);
  if (!reply?.ok) throw new Error(`${m.type}: ${reply?.error}`);
  return reply.data;
}

async function seed(sw, spec) {
  await sw.evaluate(async (spec) => {
    const make = async (parentId, items) => {
      for (const it of items) {
        if (typeof it === 'string') await chrome.bookmarks.create({ parentId, title: it.replace(/^https?:\/\//, ''), url: it });
        else {
          const f = await chrome.bookmarks.create({ parentId, title: it.folder });
          await make(f.id, it.items);
        }
      }
    };
    await make('1', spec.bar);
    await make('2', spec.other);
  }, spec);
}

async function tree(sw) {
  return sw.evaluate(async () => {
    const conv = (n) => (n.url ? n.url : { [n.title]: (n.children ?? []).map(conv) });
    const [root] = await chrome.bookmarks.getTree();
    return { bar: root.children[0].children.map(conv), other: root.children[1].children.map(conv) };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dav = await startDav();
const A = await launch('a');
const B = await launch('b');
try {
  console.log('1. seed browser A');
  await seed(A.sw, {
    bar: ['https://github.com', 'https://figma.com', { folder: 'ابزارها', items: ['https://excalidraw.com', 'https://vercel.com'] }],
    other: ['https://news.ycombinator.com', 'https://developer.mozilla.org/en-US/', { folder: 'Reading', items: ['https://overreacted.io'] }],
  });
  await seed(B.sw, { bar: ['https://github.com'], other: ['https://wikipedia.org'] });

  const pa = await A.ctx.newPage();
  await pa.goto(`chrome-extension://${A.id}/manager.html`);
  await pa.waitForSelector('text=All bookmarks', { timeout: 15000 });
  await sleep(1500);
  const countA = await pa.locator('h1').first().textContent();
  console.log('   heading:', countA);
  await pa.screenshot({ path: path.join(SHOTS, '01-library-en.png') });

  console.log('2. notes + tags via the background');
  const recs = await pa.evaluate(async () => {
    const req = indexedDB.open('xezina');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const tx = db.transaction('records');
    const all = await new Promise((r) => {
      const q = tx.objectStore('records').getAll();
      q.onsuccess = () => r(q.result);
    });
    return all;
  });
  const figma = recs.find((r) => r.v.url === 'https://figma.com/' || r.v.url === 'https://figma.com');
  assert(!!figma, 'figma record exists in the library');
  await msg(pa, { type: 'meta', ids: [figma.id], patch: { notes: 'ابزار طراحی رابط کاربری', tags: ['design', 'ui'] } });

  console.log('3. search finds notes (Persian)');
  await pa.fill('input[placeholder^="Search"]', 'طراحی');
  await sleep(400);
  const hits = await pa.locator('h3').allTextContents();
  assert(hits.some((h) => h.includes('figma')), `search by note finds figma (${hits.join(' | ')})`);
  await pa.fill('input[placeholder^="Search"]', '');

  console.log('4. connect both browsers to WebDAV');
  const cfg = { type: 'webdav', url: `http://localhost:${PORT}/`, username: 'me', password: 'pw', folder: 'e2e' };
  await msg(pa, { type: 'remote:test', config: cfg });
  await msg(pa, { type: 'remote:set', config: cfg });
  await sleep(500);
  await msg(pa, { type: 'sync' });

  const pb = await B.ctx.newPage();
  await pb.goto(`chrome-extension://${B.id}/manager.html`);
  await pb.waitForSelector('text=All bookmarks', { timeout: 15000 });
  await msg(pb, { type: 'remote:set', config: cfg });
  await sleep(500);
  await msg(pb, { type: 'sync' });
  await msg(pa, { type: 'sync' });

  const ta = await tree(A.sw);
  const tb = await tree(B.sw);
  console.log('   A:', JSON.stringify(ta));
  console.log('   B:', JSON.stringify(tb));
  assert(JSON.stringify(ta) === JSON.stringify(tb), 'both browsers have identical bookmarks');
  assert(JSON.stringify(tb).includes('excalidraw') && JSON.stringify(ta).includes('wikipedia'), 'bookmarks flowed both ways');
  assert((JSON.stringify(tb).match(/github\.com/g) ?? []).length === 1, 'github.com was not duplicated');

  console.log('5. notes travel with sync');
  const recsB = await pb.evaluate(async () => {
    const req = indexedDB.open('xezina');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    return new Promise((r) => {
      const q = db.transaction('records').objectStore('records').getAll();
      q.onsuccess = () => r(q.result);
    });
  });
  const figmaB = recsB.find((r) => r.id === figma.id);
  assert(figmaB?.v.notes === 'ابزار طراحی رابط کاربری', 'note arrived in browser B');

  console.log('6. live edit in B propagates to A');
  await B.sw.evaluate(async () => {
    const [n] = await chrome.bookmarks.search({ url: 'https://github.com/' });
    await chrome.bookmarks.update(n.id, { title: 'GitHub — renamed in B' });
  });
  await sleep(1500);
  await msg(pb, { type: 'sync' });
  await msg(pa, { type: 'sync' });
  const renamed = await A.sw.evaluate(async () => (await chrome.bookmarks.search({ url: 'https://github.com/' }))[0]?.title);
  assert(renamed === 'GitHub — renamed in B', 'rename reached A');

  console.log('7. screenshots (fa, dark, details, dashboard, settings, popup)');
  await msg(pa, { type: 'scan' });
  await pa.evaluate(() =>
    chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, lang: 'fa', theme: 'dark' } })),
  );
  await pa.reload();
  await pa.waitForSelector('text=همهٔ بوکمارک‌ها', { timeout: 15000 }).catch(() => undefined);
  await sleep(1200);
  await pa.screenshot({ path: path.join(SHOTS, '02-library-fa-dark.png') });
  await pa.locator('h3', { hasText: 'figma' }).first().click();
  await sleep(600);
  await pa.screenshot({ path: path.join(SHOTS, '03-details-fa.png') });
  await pa.keyboard.press('Escape');
  await pa.goto(`chrome-extension://${A.id}/manager.html#/dashboard`);
  await sleep(1200);
  await pa.screenshot({ path: path.join(SHOTS, '04-dashboard-fa.png') });
  await pa.goto(`chrome-extension://${A.id}/manager.html#/settings/sync`);
  await sleep(800);
  await pa.screenshot({ path: path.join(SHOTS, '05-settings-sync-fa.png') });
  for (const lang of ['ckb', 'de']) {
    await pa.evaluate(
      (lang) => chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, lang, theme: 'light' } })),
      lang,
    );
    await pa.goto(`chrome-extension://${A.id}/manager.html#/library/all`);
    await sleep(1200);
    await pa.screenshot({ path: path.join(SHOTS, `06-library-${lang}.png`) });
  }
  const pop = await A.ctx.newPage();
  await pop.setViewportSize({ width: 380, height: 560 });
  await pop.goto(`chrome-extension://${A.id}/popup.html`);
  await sleep(1000);
  await pop.screenshot({ path: path.join(SHOTS, '07-popup.png') });

  const errors = [];
  pa.on('pageerror', (e) => errors.push(e.message));
  await pa.reload();
  await sleep(1000);
  assert(errors.length === 0, 'no page errors: ' + errors.join('; '));
  console.log('\nALL GOOD — screenshots in', SHOTS);
} finally {
  await A.ctx.close();
  await B.ctx.close();
  await new Promise((r) => dav.stop(() => r()));
}
