/**
 * Browser test for the search over any page (Alt+Shift+D): the frame shows
 * over a site, finds a bookmark, opens it in a new tab (Ctrl+Enter: this one),
 * and Escape closes it.
 *   XEZINA_E2E=1 pnpm build && node scripts/e2e-spotlight.mjs [screenshot-dir] && pnpm build
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

const site = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><title>${req.url}</title></head>
    <body style="background:#fde68a;font:40px sans-serif;padding:60px">Page ${req.url}<input id="box" style="font:inherit"></body></html>`);
});
await new Promise((r) => site.listen(19881, r));
const SITE = 'http://localhost:19881/';

const dir = mkdtempSync(path.join(tmpdir(), 'xz-spot-'));
const ctx = await chromium.launchPersistentContext(dir, {
  channel: process.env.E2E_CHANNEL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 800 },
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');

try {
  console.log('1. the command is registered with Alt+Shift+D');
  const cmds = await sw.evaluate(() => chrome.commands.getAll());
  const spot = cmds.find((c) => c.name === 'spotlight');
  assert(spot, 'spotlight command exists');
  assert(spot.shortcut, `the browser gave it a key (${spot.shortcut})`);
  const manager = cmds.find((c) => c.name === 'open-manager');
  assert(manager?.shortcut, `the manager key is given too (${manager?.shortcut})`);

  await sw.evaluate(async () => {
    await chrome.bookmarks.create({ parentId: '1', title: 'Pasta Carbonara', url: 'http://localhost:19881/carbonara' });
    await chrome.bookmarks.create({ parentId: '1', title: 'Tax forms', url: 'http://localhost:19881/tax' });
  });
  await sleep(1500);

  console.log('2. the frame opens over a site');
  const page = await ctx.newPage();
  await page.goto(SITE + 'start');
  await page.bringToFront();
  // The same thing the shortcut does (the shortcut itself can't be pressed in a headless browser).
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    globalThis.__spotTab = tab.id;
  });
  const tabId = await sw.evaluate(() => globalThis.__spotTab);
  await page.evaluate((src) => {
    const f = document.createElement('iframe');
    f.id = 'xezina-spotlight';
    f.src = src;
    f.style.cssText = 'all:initial;position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:transparent;color-scheme:normal;display:block';
    addEventListener('message', (e) => {
      if (e.source === f.contentWindow && e.data === 'xezina:spotlight:close') f.remove();
    });
    f.addEventListener('load', () => f.focus());
    document.body.appendChild(f);
  }, `chrome-extension://${new URL(sw.url()).host}/spotlight.html?tab=${tabId}`);
  const frame = page.frameLocator('#xezina-spotlight');
  const input = frame.locator('input');
  await input.waitFor({ timeout: 15000 });
  assert(true, 'search box shows inside the frame');
  await input.fill('carbo');
  await frame.locator('button', { hasText: 'Pasta Carbonara' }).first().waitFor({ timeout: 5000 });
  assert(true, 'typing finds the bookmark');
  await sleep(800);
  await page.screenshot({ path: path.join(SHOTS, 'spotlight.png') });

  console.log('3. Escape closes it');
  await input.press('Escape');
  await sleep(300);
  assert((await page.locator('#xezina-spotlight').count()) === 0, 'frame removed');

  console.log('4. Enter opens the bookmark in a new tab, Ctrl+Enter in the same one');
  await page.evaluate((src) => {
    const f = document.createElement('iframe');
    f.id = 'xezina-spotlight';
    f.src = src;
    f.style.cssText = 'all:initial;position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;display:block';
    document.body.appendChild(f);
  }, `chrome-extension://${new URL(sw.url()).host}/spotlight.html?tab=${tabId}`);
  await input.waitFor({ timeout: 15000 });
  await input.fill('tax');
  await frame.locator('button', { hasText: 'Tax forms' }).first().waitFor({ timeout: 5000 });
  const [opened] = await Promise.all([ctx.waitForEvent('page'), input.press('Enter')]);
  await opened.waitForURL(SITE + 'tax', { timeout: 5000 });
  assert(page.url() === SITE + 'start', 'new tab opened, the page stayed');
  await page.evaluate((src) => {
    const f = document.createElement('iframe');
    f.id = 'xezina-spotlight2';
    f.src = src;
    f.style.cssText = 'all:initial;position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;display:block';
    document.body.appendChild(f);
  }, `chrome-extension://${new URL(sw.url()).host}/spotlight.html?tab=${tabId}`);
  const input2 = page.frameLocator('#xezina-spotlight2').locator('input');
  await input2.waitFor({ timeout: 15000 });
  await input2.fill('tax');
  await page.frameLocator('#xezina-spotlight2').locator('button', { hasText: 'Tax forms' }).first().waitFor({ timeout: 5000 });
  await input2.press('Control+Enter');
  await page.waitForURL(SITE + 'tax', { timeout: 5000 });
  assert(true, 'Ctrl+Enter replaced the page')

  console.log('5. the window version (pages that cannot hold the frame)');
  const win = await ctx.newPage();
  await win.goto(`chrome-extension://${new URL(sw.url()).host}/spotlight.html?tab=${tabId}&win=1`);
  await win.locator('input').fill('carbo');
  await win.locator('button', { hasText: 'Pasta Carbonara' }).first().waitFor({ timeout: 5000 });
  assert(true, 'window version searches too');
  console.log('\nALL PASSED');
} finally {
  await ctx.close();
  site.close();
}
