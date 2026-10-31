/**
 * Copies the Chrome build into the folder(s) your browsers load Xezina from
 * ("Load unpacked"), so updating needs no download. Keeping the same folder
 * keeps the same extension id, so bookmarks, notes and settings stay.
 *
 *   pnpm local                       # build + copy to the saved folder(s)
 *   pnpm local -- "D:\path\to\dir"   # first time: choose the folder
 *
 * The folders are remembered in .local-install.json (not committed):
 *
 *   { "target": "C:\\...\\xezina-chrome", "fixedId": false,
 *     "more": [{ "target": "C:\\...\\xezina-edge", "fixedId": true }] }
 *
 * "fixedId": true keeps the manifest key, so the install gets Xezina's fixed id
 * (needed for Google sign-in). An install made before Xezina had a fixed id
 * keeps its old id (and with it its notes, tags and images) while it is false.
 * A running Xezina notices the new build within a minute and reloads itself.
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CONFIG = path.resolve('.local-install.json');
const SRC = path.resolve('.output/chrome-mv3');

if (process.argv[2]) writeFileSync(CONFIG, JSON.stringify({ target: process.argv[2], fixedId: true }, null, 2));
const config = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : {};
if (!config.target) {
  console.error('Tell me the folder once:  pnpm local -- "C:\\path\\to\\xezina-chrome"');
  process.exit(1);
}
if (!existsSync(path.join(SRC, 'manifest.json'))) {
  console.error('No build found; run "pnpm build" first.');
  process.exit(1);
}
const version = JSON.parse(readFileSync(path.join(SRC, 'manifest.json'), 'utf8')).version;

for (const { target: dir, fixedId } of [config, ...(config.more ?? [])]) {
  const target = path.resolve(dir);
  // Only ever clear a folder that holds a Xezina build (or nothing).
  if (existsSync(target)) {
    const entries = readdirSync(target);
    const isXezina = (() => {
      try {
        const msg = JSON.parse(readFileSync(path.join(target, '_locales/en/messages.json'), 'utf8'));
        return msg.extName?.message === 'Xezina';
      } catch {
        return false;
      }
    })();
    if (entries.length && !isXezina) {
      console.error(`Refusing to overwrite ${target}: it does not look like a Xezina build.`);
      process.exit(1);
    }
    for (const e of entries) rmSync(path.join(target, e), { recursive: true, force: true });
  }

  cpSync(SRC, target, { recursive: true });
  if (!fixedId) {
    const mf = path.join(target, 'manifest.json');
    const manifest = JSON.parse(readFileSync(mf, 'utf8'));
    delete manifest.key;
    writeFileSync(mf, JSON.stringify(manifest));
  }
  // The running extension watches this file and reloads itself when it changes.
  writeFileSync(path.join(target, 'build.json'), JSON.stringify({ version, builtAt: Date.now() }));
  console.log(`Xezina ${version} installed to ${target}${fixedId ? ' (fixed id)' : ''}`);
}
console.log('It reloads itself within a minute (or press ⟳ on the extensions page).');
