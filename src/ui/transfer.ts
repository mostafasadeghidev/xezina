import { browser } from 'wxt/browser';
import type { Tree, TreeNode } from '../core/tree';
import { ROOT } from '../core/types';
import { db } from '../db/db';
import { send } from '../lib/messages';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stamp = () => new Date().toISOString().slice(0, 10);

const ROOT_TITLES: Record<string, string> = {
  [ROOT.toolbar]: 'Bookmarks bar',
  [ROOT.other]: 'Other bookmarks',
  [ROOT.menu]: 'Bookmarks menu',
  [ROOT.mobile]: 'Mobile bookmarks',
};

/** Netscape bookmark file — every browser can import it. */
export function exportHtml(tree: Tree) {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  const sec = (ms?: number) => (ms ? Math.floor(ms / 1000) : '');
  const walk = (n: TreeNode, depth: number) => {
    const pad = '    '.repeat(depth);
    for (const c of n.children) {
      if (c.kind === 'folder') {
        lines.push(`${pad}<DT><H3 ADD_DATE="${sec(c.rec.v.addedAt)}">${esc(c.title)}</H3>`);
        lines.push(`${pad}<DL><p>`);
        walk(c, depth + 1);
        lines.push(`${pad}</DL><p>`);
      } else if (c.kind === 'bookmark') {
        const tags = (c.rec.v.tags ?? []).join(',');
        lines.push(`${pad}<DT><A HREF="${esc(c.url)}" ADD_DATE="${sec(c.rec.v.addedAt)}"${tags ? ` TAGS="${esc(tags)}"` : ''}>${esc(c.title)}</A>`);
        if (c.rec.v.notes) lines.push(`${pad}<DD>${esc(c.rec.v.notes)}`);
      } else {
        lines.push(`${pad}<HR>`);
      }
    }
  };
  for (const rid of [ROOT.toolbar, ROOT.other, ROOT.menu, ROOT.mobile]) {
    const r = tree.roots[rid];
    if (!r.children.length) continue;
    const toolbar = rid === ROOT.toolbar ? ' PERSONAL_TOOLBAR_FOLDER="true"' : '';
    lines.push(`    <DT><H3${toolbar}>${ROOT_TITLES[rid]}</H3>`);
    lines.push('    <DL><p>');
    walk(r, 2);
    lines.push('    </DL><p>');
  }
  lines.push('</DL><p>');
  download(`xezina-bookmarks-${stamp()}.html`, lines.join('\n'), 'text/html');
}

interface JsonNode {
  title: string;
  url?: string;
  type: string;
  notes?: string;
  tags?: string[];
  favorite?: boolean;
  description?: string;
  added?: string;
  children?: JsonNode[];
}

export function exportJson(tree: Tree) {
  const conv = (n: TreeNode): JsonNode => {
    const v = n.rec.v;
    const out: JsonNode = { title: n.title, type: n.kind };
    if (n.kind === 'bookmark') out.url = n.url;
    if (v.notes) out.notes = v.notes;
    if (v.tags?.length) out.tags = v.tags;
    if (v.fav) out.favorite = true;
    if (v.desc) out.description = v.desc;
    if (v.addedAt) out.added = new Date(v.addedAt).toISOString();
    if (n.kind === 'folder') out.children = n.children.map(conv);
    return out;
  };
  const roots = Object.fromEntries(
    [ROOT.toolbar, ROOT.other, ROOT.menu, ROOT.mobile].map((r) => [r.replace('root_', ''), tree.roots[r].children.map(conv)]),
  );
  download(
    `xezina-bookmarks-${stamp()}.json`,
    JSON.stringify({ app: 'xezina', exportedAt: new Date().toISOString(), roots }, null, 2),
    'application/json',
  );
}

/** Imports a Netscape bookmark file into a new folder under "Other bookmarks". */
export async function importHtml(html: string): Promise<{ count: number; folder: string }> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rootDl = doc.querySelector('dl');
  if (!rootDl) throw new Error('Not a bookmarks file');
  const device = (await db.kv.get('device'))?.value as { map?: Record<string, string> } | undefined;
  const otherId = device?.map?.[ROOT.other];
  if (!otherId) throw new Error('Open the library once before importing.');
  const folderName = `Imported ${stamp()}`;
  const top = await browser.bookmarks.create({ parentId: otherId, title: folderName });
  let count = 0;
  const pending: { url: string; notes: string; tags: string[] }[] = [];

  const walk = async (dl: Element, parentId: string) => {
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue;
      const h3 = dt.querySelector(':scope > h3');
      const a = dt.querySelector(':scope > a');
      if (h3) {
        const f = await browser.bookmarks.create({ parentId, title: h3.textContent ?? '' });
        const sub = dt.querySelector(':scope > dl');
        if (sub) await walk(sub, f.id);
      } else if (a) {
        const url = a.getAttribute('href') ?? '';
        if (!url) continue;
        try {
          await browser.bookmarks.create({ parentId, title: a.textContent ?? url, url });
          count++;
          const dd = dt.nextElementSibling?.tagName === 'DD' ? (dt.nextElementSibling.textContent ?? '').trim() : '';
          const tags = (a.getAttribute('tags') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
          if (dd || tags.length) pending.push({ url, notes: dd, tags });
        } catch {
          // unsupported URL in this browser
        }
      }
    }
  };
  await walk(rootDl, top.id);
  await send({ type: 'scan' });

  // Notes and tags from the file (e.g. from a Xezina export).
  if (pending.length) {
    const recs = await db.records.toArray();
    for (const p of pending) {
      const rec = recs.find((r) => r.v.url === p.url && !r.v.del && (r.v.notes ?? '') === '');
      if (rec) await send({ type: 'meta', ids: [rec.id], patch: { ...(p.notes ? { notes: p.notes } : {}), ...(p.tags.length ? { tags: p.tags } : {}) } });
    }
  }
  return { count, folder: folderName };
}
