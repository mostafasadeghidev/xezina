/**
 * Renders the screenshots used in the README and on the website.
 *   pnpm build && node scripts/screenshots.mjs
 */
import { chromium } from 'playwright-core';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT = path.resolve('.output/chrome-mv3');
const OUT = path.resolve(process.argv[2] ?? 'docs/screenshots');
mkdirSync(OUT, { recursive: true });

const LIBRARY = {
  bar: [
    'https://github.com/',
    'https://developer.mozilla.org/',
    { folder: 'Design', items: ['https://www.figma.com/', 'https://dribbble.com/', 'https://coolors.co/', 'https://unsplash.com/', 'https://fonts.google.com/'] },
    { folder: 'Dev', items: ['https://vercel.com/', 'https://stackoverflow.com/', 'https://caniuse.com/', 'https://regex101.com/', 'https://tailwindcss.com/'] },
  ],
  other: [
    { folder: 'Learning', items: ['https://www.coursera.org/', 'https://www.khanacademy.org/', 'https://roadmap.sh/'] },
    { folder: 'News', items: ['https://news.ycombinator.com/', 'https://www.theverge.com/'] },
    { folder: 'Tools', items: ['https://excalidraw.com/', 'https://www.notion.so/', 'https://translate.google.com/', 'https://squoosh.app/'] },
    'https://en.wikipedia.org/',
  ],
};

const META = {
  'https://www.figma.com/': { notes: 'Interface design, prototypes and the team design system.', tags: ['design', 'ui'], fav: true },
  'https://coolors.co/': { notes: 'Quick color palettes for new projects.', tags: ['design', 'color'] },
  'https://github.com/': { tags: ['code'], fav: true },
  'https://regex101.com/': { notes: 'Test regular expressions with explanations.', tags: ['code', 'tools'] },
  'https://excalidraw.com/': { notes: 'Hand-drawn diagrams for meetings.', tags: ['tools', 'diagram'], fav: true },
  'https://roadmap.sh/': { notes: 'Learning paths for frontend and backend.', tags: ['learning'] },
  'https://squoosh.app/': { notes: 'Compress images in the browser.', tags: ['tools', 'images'] },
  'https://caniuse.com/': { tags: ['code', 'css'] },
};

const TITLES = {
  'https://github.com/': 'GitHub',
  'https://developer.mozilla.org/': 'MDN Web Docs',
  'https://www.figma.com/': 'Figma',
  'https://dribbble.com/': 'Dribbble — Discover the world’s top designers',
  'https://coolors.co/': 'Coolors — color palette generator',
  'https://unsplash.com/': 'Unsplash — free photos',
  'https://fonts.google.com/': 'Google Fonts',
  'https://vercel.com/': 'Vercel',
  'https://stackoverflow.com/': 'Stack Overflow',
  'https://caniuse.com/': 'Can I use…',
  'https://regex101.com/': 'regex101',
  'https://tailwindcss.com/': 'Tailwind CSS',
  'https://www.coursera.org/': 'Coursera',
  'https://www.khanacademy.org/': 'Khan Academy',
  'https://roadmap.sh/': 'roadmap.sh — developer roadmaps',
  'https://news.ycombinator.com/': 'Hacker News',
  'https://www.theverge.com/': 'The Verge',
  'https://excalidraw.com/': 'Excalidraw',
  'https://www.notion.so/': 'Notion',
  'https://translate.google.com/': 'Google Translate',
  'https://squoosh.app/': 'Squoosh',
  'https://en.wikipedia.org/': 'Wikipedia',
};

const dir = mkdtempSync(path.join(tmpdir(), 'xz-shots-'));
const ctx = await chromium.launchPersistentContext(dir, {
  channel: process.env.E2E_CHANNEL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await sw.evaluate(
  async ({ lib, titles }) => {
    const make = async (parentId, items) => {
      for (const it of items) {
        if (typeof it === 'string') await chrome.bookmarks.create({ parentId, title: titles[it] ?? it, url: it });
        else {
          const f = await chrome.bookmarks.create({ parentId, title: it.folder });
          await make(f.id, it.items);
        }
      }
    };
    await make('1', lib.bar);
    await make('2', lib.other);
  },
  { lib: LIBRARY, titles: TITLES },
);

const page = await ctx.newPage();
const url = (hash = '#/library/all') => `chrome-extension://${id}/manager.html${hash}`;
await page.goto(url());
await page.waitForSelector('h1');
await sleep(1500);

const records = await page.evaluate(async () => {
  const req = indexedDB.open('xezina');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  return new Promise((r) => {
    const q = db.transaction('records').objectStore('records').getAll();
    q.onsuccess = () => r(q.result);
  });
});
for (const [u, meta] of Object.entries(META)) {
  const rec = records.find((r) => r.v.url === u);
  if (!rec) continue;
  await page.evaluate(({ id, meta }) => chrome.runtime.sendMessage({ type: 'meta', ids: [id], patch: meta }), { id: rec.id, meta });
}

const setUi = (lang, theme) =>
  page.evaluate(
    ({ lang, theme }) =>
      chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, lang, theme } })),
    { lang, theme },
  );

async function shot(name, hash, lang, theme, after) {
  await setUi(lang, theme);
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector('h1');
  await sleep(900);
  if (after) await after();
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('  ', name);
}

const figmaId = records.find((r) => r.v.url === 'https://www.figma.com/')?.id;
await shot('library-light.png', '#/library/all', 'en', 'light');
await shot('library-dark.png', '#/library/all', 'en', 'dark');
await shot('library-fa.png', '#/library/all', 'fa', 'dark');
await shot('details.png', '#/library/all', 'en', 'dark', async () => {
  await page.locator('h3', { hasText: 'Figma' }).first().click();
  await sleep(500);
});
await shot('search.png', '#/library/all', 'en', 'light', async () => {
  await page.fill('input[placeholder^="Search"]', 'diagram');
  await sleep(400);
});
await shot('list.png', '#/library/all', 'en', 'light', async () => {
  await page.locator('button[title="List"]').click();
  await sleep(400);
});
await page.locator('button[title="Cards"]').click();
await shot('dashboard.png', '#/dashboard', 'en', 'dark');
await shot('sync.png', '#/settings/sync', 'en', 'dark', async () => {
  await page.locator('button', { hasText: 'WebDAV' }).first().click();
  await sleep(300);
});
void figmaId;
await ctx.close();
console.log('done →', OUT);
