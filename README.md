<div align="center">

<img src="docs/logo.png" width="88" alt="Xezina logo">

# Xezina

**Your bookmarks, in every browser — organized, searchable, and stored where *you* choose.**

[![Release](https://img.shields.io/github/v/release/mostafasadeghidev/xezina?color=5b5bf0&label=release)](https://github.com/mostafasadeghidev/xezina/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/mostafasadeghidev/xezina/ci.yml?label=tests)](https://github.com/mostafasadeghidev/xezina/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Chrome · Edge · Firefox · Brave](https://img.shields.io/badge/browsers-Chrome%20·%20Edge%20·%20Firefox%20·%20Brave-555)

**English** · [فارسی](docs/readme/README.fa.md) · [کوردی](docs/readme/README.ckb.md) · [العربية](docs/readme/README.ar.md) · [Deutsch](docs/readme/README.de.md) · [Français](docs/readme/README.fr.md) · [Italiano](docs/readme/README.it.md) · [Português](docs/readme/README.pt.md)

[Website](https://mostafasadeghidev.github.io/xezina/) · [Download](https://github.com/mostafasadeghidev/xezina/releases/latest) · [Privacy](https://mostafasadeghidev.github.io/xezina/privacy.html)

<img src="docs/screenshots/library-dark.png" alt="Xezina library" width="900">

</div>

## Why Xezina?

You save hundreds of pages, then can't find them, and each browser has a different set.
Xezina fixes both:

- **One set of bookmarks everywhere.** Chrome, Edge, Brave, Opera, Vivaldi and Firefox stay identical.
- **A library you can actually search.** Notes, tags, previews and instant search across everything.
- **No account, no server of ours.** Your data stays in your own cloud or server.

## Features

| | |
|---|---|
| 🔄 **Real two-way sync** | Changes made in different browsers at the same time are merged field by field. A rename in one browser and a move in another both survive. |
| ☁️ **Your choice of storage** | Google Drive, Dropbox, OneDrive, WebDAV/Nextcloud, S3/Cloudflare R2, or a private GitHub repository. |
| 🔎 **Search everything** | Titles, addresses, your notes, tags, folder names and page descriptions. Tolerates typos and understands Persian/Arabic letter variants. Use `#tag` and `site:example.com` filters, or type `bm` + space in the address bar. |
| 🏠 **Home & new tab** | Spotlight-style search with live suggestions and a preview of each result. Can also be your new tab page. |
| ⭐ **Works with the browser’s star** | Bookmark with the star or Ctrl+D as usual: Xezina adds a screenshot and the page description, then lets you add notes. Or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>. |
| 🏷️ **Short titles stay short** | Keep a one-letter title (or none) in the bookmarks bar; Xezina shows a display name and the page’s real title, and finds it by both. |
| 📝 **Notes & tags** | Write why you saved a page and tag it. Notes and tags sync with the bookmark. |
| 🖼️ **Previews** | The site's own preview image, or a screenshot taken when you visit a bookmarked page. |
| 🧹 **Clean-up tools** | Find duplicates and broken links. Move, tag or delete many bookmarks at once, or drag them onto a folder. |
| 🔐 **End-to-end encryption** | Optional. Data is encrypted in your browser with your passphrase (AES-256-GCM) before it is uploaded. |
| 🛟 **Safety net** | Automatic backup before every sync, one-click restore, and a confirmation before any sync that would delete many bookmarks. |
| 🌍 **8 languages** | English, فارسی, کوردی (سۆرانی), العربية, Deutsch, Français, Italiano, Português — with full right-to-left layout. |

<div align="center">
<img src="docs/screenshots/details.png" alt="Notes and tags" width="440">
<img src="docs/screenshots/dashboard.png" alt="Dashboard" width="440">
</div>

## Storage options

| Storage | Best for | What you need |
|---|---|---|
| **Google Drive** | everyone | sign in — files go to a hidden app folder |
| **Dropbox** | everyone | sign in — files go to `Apps/Xezina` |
| **OneDrive** | everyone | sign in — files go to `Apps/Xezina` |
| **WebDAV** | Nextcloud, ownCloud, Synology, QNAP, your own server | address, username, app password |
| **S3-compatible** | Cloudflare R2, ArvanCloud, AWS S3, MinIO, Backblaze B2 | endpoint, bucket, access keys |
| **GitHub** | developers; full version history | a fine-grained token (Xezina creates a private repository) |

## Install

1. Download the latest zip from **[Releases](https://github.com/mostafasadeghidev/xezina/releases/latest)**.
2. **Chrome, Edge, Brave, Opera, Vivaldi:** unzip `xezina-*-chrome.zip` → open `chrome://extensions`
   (`edge://extensions` in Edge) → turn on **Developer mode** → **Load unpacked** → choose the unzipped folder.
3. **Firefox:** use `xezina-*-firefox.zip`. A signed version will be published on addons.mozilla.org.

Keep the unzipped folder in place: the browser loads the extension from it.

## Quick start

1. Open Xezina with <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>, or click the toolbar icon → the grid button.
2. Go to **Settings → Sync**, choose a storage and connect.
3. Install Xezina in your other browsers and connect them to **the same storage**.
   If you use encryption, enter the same passphrase.
4. Done. Your bookmarks show up in each browser's own bookmarks bar and menu. Open the Xezina
   manager only when you want to search, write notes or tidy up.

> [!TIP]
> Turn off the browser's own bookmark sync (Chrome Sync for bookmarks, Edge favorites sync) on
> devices where Xezina syncs, so two systems don't edit the same bookmarks.

> [!NOTE]
> The first time a browser connects, bookmarks it already shares with the others (same folder,
> same address) are matched rather than duplicated. To make a browser **exactly** match the cloud
> copy instead, use **Settings → Sync → Make this browser match the cloud** once. A backup is made first.

## FAQ

<details>
<summary><b>Does Xezina see my bookmarks or browsing?</b></summary>

No. There is no Xezina server. Everything goes directly from your browser to the storage you
picked. Pages are read only if you allow previews, and only pages you bookmarked.
</details>

<details>
<summary><b>What happens if I edit the same bookmark in two browsers?</b></summary>

Each field (title, address, folder, position, notes, tags) is merged separately, and the most
recent change to that field wins. Different changes to the same bookmark are all kept.
</details>

<details>
<summary><b>What if a sync goes wrong?</b></summary>

Xezina backs up before every sync that changes your bookmarks. Restore any of the last 30
backups under **Settings → Backups & data**. A sync that would delete many bookmarks waits for
your confirmation.
</details>

<details>
<summary><b>Google Drive / Dropbox / OneDrive sign-in says the app is not configured.</b></summary>

These services need a one-time app registration by whoever publishes the build. See
[docs/oauth-setup.md](docs/oauth-setup.md). WebDAV, S3 and GitHub work without it.
</details>

<details>
<summary><b>Can I export my bookmarks?</b></summary>

Yes. Export to standard HTML (importable by any browser) or JSON (with notes and tags), and
import HTML files, under **Settings → Backups & data**.
</details>

## How sync works

Every bookmark is a record whose fields each carry a hybrid-logical-clock timestamp. Each device
uploads its full merged copy as a single file (`devices/<id>.xz`) and reads the other devices'
files. Merging takes the newest value of every field, so the result is the same in whatever order
files arrive (a state-based CRDT). Because each device writes only its own file, any plain file
storage works, and two devices can never overwrite each other. Deleted items are kept as
tombstones; a folder deleted on one device that gets a new bookmark on another comes back with
that bookmark. Order inside folders uses fractional indexing.

## Development

```bash
pnpm install
pnpm dev                 # Chrome with live reload  (pnpm dev:firefox for Firefox)
pnpm test                # unit tests + randomized multi-browser sync simulations
pnpm build && node scripts/e2e.mjs        # two real Edge profiles syncing over WebDAV
pnpm build && node scripts/screenshots.mjs  # regenerate docs/screenshots
pnpm zip && pnpm zip:firefox
```

| Folder | Contents |
|---|---|
| `src/core` | data model, CRDT merge, ordering, search |
| `src/sync` | reading/applying browser bookmarks, first-contact matching, encryption |
| `src/storage` | one small adapter per storage provider |
| `src/background` | scheduler, previews, link checker |
| `src/ui` | manager, popup, translations (`src/ui/i18n`) |
| `docs` | website (GitHub Pages), screenshots, translated READMEs |

**Sign-in apps:** Google Drive, Dropbox, OneDrive and "Sign in with GitHub" need OAuth client ids,
read at build time from `.env` (see `.env.example`) or entered by users under
**Settings → Advanced**. Step-by-step guide: [docs/oauth-setup.md](docs/oauth-setup.md).

**Translations:** UI strings live in `src/ui/i18n/<lang>.ts`, website strings in
`docs/i18n/<lang>.js`. Corrections from native speakers are very welcome.

## License

[MIT](LICENSE) © Mostafa Sadeghi
