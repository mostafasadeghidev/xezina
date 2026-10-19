/**
 * Copies the Chrome build into the folder your browser loads Xezina from
 * ("Load unpacked"), so updating needs no download. Keeping the same folder
 * keeps the same extension id, so bookmarks, notes and settings stay.
 *
 *   pnpm local                       # build + copy to the saved folder
 *   pnpm local -- "D:\path\to\dir"   # first time: choose the folder
 *
 * The folder is remembered in .local-install.json (not committed).
 * A running Xezina notices the new build within a minute and reloads itself.
 */
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CONFIG = path.resolve('.local-install.json');
const SRC = path.resolve('.output/chrome-mv3');

let target = process.argv[2];
if (target) writeFileSync(CONFIG, JSON.stringify({ target, fixedId: true }, null, 2));
else if (existsSync(CONFIG)) target = JSON.parse(readFileSync(CONFIG, 'utf8')).target;
if (!target) {
  console.error('Tell me the folder once:  pnpm local -- "C:\\path\\to\\xezina-chrome"');
  process.exit(1);
}
target = path.resolve(target);
if (!existsSync(path.join(SRC, 'manifest.json'))) {
  console.error('No build found; run "pnpm build" first.');
  process.exit(1);
}

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
// An install made before Xezina had a fixed id keeps its old id (and with it its
// notes, tags and images) until you opt in with "fixedId": true in .local-install.json.
const local = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : {};
if (!local.fixedId) {
  const mf = path.join(target, 'manifest.json');
  const manifest = JSON.parse(readFileSync(mf, 'utf8'));
  delete manifest.key;
  writeFileSync(mf, JSON.stringify(manifest));
}
const version = JSON.parse(readFileSync(path.join(SRC, 'manifest.json'), 'utf8')).version;
// The running extension watches this file and reloads itself when it changes.
writeFileSync(path.join(target, 'build.json'), JSON.stringify({ version, builtAt: Date.now() }));
console.log(`Xezina ${version} installed to ${target}`);
console.log('It reloads itself within a minute (or press ⟳ on chrome://extensions).');
