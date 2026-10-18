<p align="center"><img src="docs/logo.png" width="96" alt="Xezina"></p>

<h1 align="center">Xezina</h1>

<p align="center">
Sync, organize and search your bookmarks across every browser — with storage <b>you</b> own.<br>
<a href="README.fa.md">فارسی</a> · <a href="https://mostafasadeghidev.github.io/xezina/">Website</a> · <a href="https://mostafasadeghidev.github.io/xezina/privacy.html">Privacy</a>
</p>

---

Xezina is a browser extension for Chrome, Edge, Brave, Opera, Vivaldi and Firefox. It keeps your
bookmarks identical in all of them, and gives you a fast manager with notes, tags, previews and
full-text search. There is no Xezina server: your data lives in your own Google Drive, Dropbox,
OneDrive, Nextcloud/WebDAV, S3/Cloudflare R2 or GitHub.

## Features

- **Real two-way sync.** Edits made in different browsers at the same time are merged field by
  field: a rename in Chrome and a move in Firefox both survive. Nothing is wiped and re-created.
- **Choose your storage**:

  | Storage | Good for | Setup |
  |---|---|---|
  | Google Drive | everyone | sign in (hidden app folder) |
  | Dropbox | everyone | sign in (Apps/Xezina folder) |
  | OneDrive | everyone | sign in (Apps/Xezina folder) |
  | WebDAV | Nextcloud, ownCloud, Synology, QNAP, your server | address + app password |
  | S3-compatible | Cloudflare R2, ArvanCloud, AWS, MinIO, Backblaze | keys |
  | GitHub | developers; full history in a private repo | sign in or token |

- **Manager**: grid and list views, folder tree, drag and drop, bulk move/tag/delete, favorites,
  duplicates finder, broken-link finder, dashboard.
- **Notes and tags** on every bookmark, synced with it.
- **Search everything**: title, address, site, your notes, tags, folder names and the page's own
  description. Typo-tolerant; understands Persian/Arabic letter variants. `#tag` and `site:host`
  filters. From the address bar too: type `bm` + space.
- **Previews**: the site's preview image, or a screenshot taken when you visit a bookmarked page.
- **End-to-end encryption** (optional): data is encrypted in your browser with a passphrase
  (AES-256-GCM, PBKDF2) before it is uploaded.
- **Safety**: automatic backup before every sync that changes your bookmarks, one-click restore,
  and a guard that asks before a sync deletes many bookmarks at once.
- **8 languages**: English, فارسی, کوردی (سۆرانی), العربية, Deutsch, Français, Italiano, Português — with
  right-to-left layout.

## Install

Until store listings are live, download the latest build from
[Releases](https://github.com/mostafasadeghidev/xezina/releases):

- **Chrome / Edge / Brave / Opera / Vivaldi**: unzip `xezina-*-chrome.zip`, open
  `chrome://extensions`, enable *Developer mode*, click *Load unpacked* and pick the folder.
- **Firefox**: `xezina-*-firefox.zip` (signed builds will be published on addons.mozilla.org).

Then open Xezina (toolbar icon → grid button, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>) →
**Settings → Sync** and choose where to store your bookmarks. Do the same on every browser.

> Tip: turn off the browser's own bookmark sync (e.g. Chrome Sync for bookmarks) on devices where
> Xezina syncs, so two systems don't edit the same bookmarks.

## How sync works

Each device keeps every bookmark as a record whose fields (title, address, folder, position,
notes, tags…) carry a hybrid-logical-clock stamp. A device uploads its whole merged copy as one
file (`devices/<id>.xz`) and reads the other devices' files; merging takes the newest value of
each field, so the result is the same no matter the order (a state-based CRDT). Because every
device writes only its own file, any plain file storage works and two devices never overwrite
each other. Deletions are kept as tombstones; a folder deleted on one device and given a new
bookmark on another comes back with that bookmark. Order inside folders uses fractional indexes.

The first time a browser joins, bookmarks it already shares with the cloud copy (same folder and
address) are matched instead of duplicated.

## Develop

```bash
pnpm install
pnpm dev            # Chrome with hot reload
pnpm dev:firefox
pnpm test           # unit + sync simulation tests (incl. randomized multi-browser runs)
pnpm build && node scripts/e2e.mjs   # two real Edge profiles syncing through a local WebDAV server
pnpm zip && pnpm zip:firefox
```

Code map: `src/core` (data model, CRDT merge, ordering, search), `src/sync` (scan, apply,
first-contact matching, encryption), `src/storage` (one small adapter per provider),
`src/background` (scheduler, previews, link checks), `src/ui` (manager and popup).

### Sign-in apps (optional)

Google Drive, Dropbox, OneDrive and "Sign in with GitHub" need an OAuth app id. They are read
at build time from `.env` (see `.env.example`) and can also be entered by users under
**Settings → Advanced**. See [docs/oauth-setup.md](docs/oauth-setup.md). WebDAV, S3 and GitHub
tokens need nothing.

## License

MIT
