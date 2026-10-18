import { Folder, X } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { hostOf, uniqueTags } from '../../core/normalize';
import type { Tree, TreeNode } from '../../core/tree';
import { isRoot, ROOT } from '../../core/types';
import { faviconUrl, useBlobUrl } from '../hooks';
import { useI18n, type StringKey } from '../i18n';
import { cx, inputClass } from './ui';

const ROOT_KEYS: Record<string, StringKey> = {
  [ROOT.toolbar]: 'rootToolbar',
  [ROOT.other]: 'rootOther',
  [ROOT.menu]: 'rootMenu',
  [ROOT.mobile]: 'rootMobile',
};

/** Localized name of a folder (built-in folders get translated names). */
export function useFolderName() {
  const { t } = useI18n();
  return (node: TreeNode | undefined) => (node ? (isRoot(node.id) ? t(ROOT_KEYS[node.id]) : node.title || '—') : '');
}

function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function Favicon({ url, size = 16, remote = true }: { url: string; size?: number; remote?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = faviconUrl(url, remote);
  const host = hostOf(url);
  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.6, background: `hsl(${hue(host)} 55% 50%)` }}
      >
        {(host[0] ?? '•').toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-sm" onError={() => setFailed(true)} loading="lazy" />;
}

/** Preview image, or a colored placeholder with the site's initial. */
export function Preview({ node, className, remote }: { node: TreeNode; className?: string; remote: boolean }) {
  const src = useBlobUrl(node.rec.v.img || undefined);
  const host = hostOf(node.url);
  if (src) return <img src={src} alt="" loading="lazy" className={cx('h-full w-full object-cover', className)} />;
  const h = hue(host);
  return (
    <div
      className={cx('flex h-full w-full items-center justify-center', className)}
      style={{ background: `linear-gradient(135deg, hsl(${h} 60% 55% / .22), hsl(${(h + 40) % 360} 60% 50% / .10))` }}
    >
      <div className="flex w-full flex-col items-center gap-2 px-4 opacity-80">
        <Favicon url={node.url} size={28} remote={remote} />
        <span className="ltr max-w-full truncate text-xs text-muted">{host}</span>
      </div>
    </div>
  );
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return suggestions.filter((s) => s.includes(q) && !value.includes(s)).slice(0, 6);
  }, [text, suggestions, value]);
  const add = (t: string) => {
    const next = uniqueTags([...value, ...t.split(/[,،]/)]);
    onChange(next);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === '،') && text.trim()) {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="relative">
      <div className={cx(inputClass, 'flex min-h-10 flex-wrap items-center gap-1.5 py-1.5')}>
        {value.map((t) => (
          <span key={t} dir="auto" className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent">
            #{t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
        />
      </div>
      {matches.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(m);
              }}
              className="block w-full px-3 py-1.5 text-start text-sm hover:bg-hover"
            >
              #{m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Flat, indented list of folders for <select>. */
export function folderOptions(tree: Tree, name: (n: TreeNode) => string): { id: string; label: string; depth: number }[] {
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (n: TreeNode, depth: number) => {
    out.push({ id: n.id, label: name(n), depth });
    for (const c of n.children) if (c.kind === 'folder') walk(c, depth + 1);
  };
  for (const rid of [ROOT.toolbar, ROOT.other, ROOT.menu, ROOT.mobile]) {
    const r = tree.roots[rid];
    if (rid === ROOT.menu || rid === ROOT.mobile) {
      if (!r.children.length) continue;
    }
    walk(r, 0);
  }
  return out;
}

export function FolderSelect({
  tree,
  value,
  onChange,
  exclude,
}: {
  tree: Tree;
  value: string;
  onChange: (id: string) => void;
  exclude?: string;
}) {
  const name = useFolderName();
  const opts = folderOptions(tree, (n) => name(n));
  return (
    <div className="relative">
      <Folder className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, 'h-10 cursor-pointer ps-9')}>
        {opts
          .filter((o) => o.id !== exclude)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {'  '.repeat(o.depth) + o.label}
            </option>
          ))}
      </select>
    </div>
  );
}
