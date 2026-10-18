import { ArrowUpRight, Check, CopyCheck, Folder } from 'lucide-react';
import { useMemo, useState } from 'react';
import { displayTitle } from '../../core/normalize';
import { Favicon, useFolderName } from '../components/bits';
import { Badge, Button, cx } from '../components/ui';
import type { Library } from '../hooks';
import { useI18n } from '../i18n';
import { pickKeeper } from '../library';

/**
 * Duplicates grouped by address. One copy per group is marked "kept";
 * "Select extras" selects every other copy so they can be deleted in one go.
 */
export function Duplicates({
  lib,
  selected,
  setSelected,
  openDetails,
  remote,
}: {
  lib: Library;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  openDetails: (id: string) => void;
  remote: boolean;
}) {
  const { t, date } = useI18n();
  const name = useFolderName();
  const [override, setOverride] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const out: { key: string; ids: string[]; keep: string }[] = [];
    for (const [key, ids] of lib.dupGroups) {
      const alive = ids.filter((id) => lib.tree.byId.has(id));
      if (alive.length < 2) continue;
      const keep = override[key] && alive.includes(override[key]) ? override[key] : pickKeeper(lib, alive);
      out.push({ key, ids: alive, keep });
    }
    return out.sort((a, b) => b.ids.length - a.ids.length || a.key.localeCompare(b.key));
  }, [lib, override]);

  /** "Bookmarks bar / Design / Tools" with translated built-in folder names. */
  const folderPath = (folderId: string) => {
    const parts: string[] = [];
    let cur = lib.tree.byId.get(folderId);
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(name(cur));
      cur = cur.parent ? lib.tree.byId.get(cur.parent) : undefined;
    }
    return parts.join(' / ');
  };

  const extras = groups.flatMap((g) => g.ids.filter((id) => id !== g.keep));

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };

  const keep = (key: string, id: string) => {
    setOverride((o) => ({ ...o, [key]: id }));
    if (selected.has(id)) {
      const n = new Set(selected);
      n.delete(id);
      // The previous keeper becomes an extra.
      const prev = groups.find((g) => g.key === key)?.keep;
      if (prev && prev !== id) n.add(prev);
      setSelected(n);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-4">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{t('dupGroups', { n: groups.length })}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{t('dupHint')}</p>
        </div>
        <Button variant="primary" icon={<CopyCheck className="size-4" />} disabled={!extras.length} onClick={() => setSelected(new Set(extras))}>
          {t('dupSelectExtras')}
        </Button>
      </div>

      {groups.map((g) => {
        const first = lib.tree.byId.get(g.ids[0])!;
        return (
          <div key={g.key} className="cv-auto overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex items-center gap-2.5 border-b border-line bg-hover/60 px-4 py-2.5">
              <Favicon url={first.url} remote={remote} />
              <span className="ltr min-w-0 flex-1 truncate text-start text-sm font-medium">{first.url}</span>
              <Badge>{g.ids.length}×</Badge>
              <a href={first.url} target="_blank" rel="noreferrer" className="text-muted hover:text-accent">
                <ArrowUpRight className="size-4" />
              </a>
            </div>
            {g.ids.map((id) => {
              const n = lib.tree.byId.get(id)!;
              const isKeep = id === g.keep;
              const isSel = selected.has(id);
              return (
                <div key={id} className={cx('flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0', isSel && 'bg-danger/5')}>
                  <button
                    onClick={() => toggle(id)}
                    className={cx(
                      'flex size-5 shrink-0 items-center justify-center rounded border transition',
                      isSel ? 'border-danger bg-danger text-white' : 'border-line text-transparent hover:border-muted',
                    )}
                    aria-label="select"
                  >
                    <Check className="size-3" />
                  </button>
                  <button onClick={() => openDetails(id)} className="min-w-0 flex-1 text-start">
                    <div dir="auto" className="truncate text-[13.5px] font-medium">
                      {displayTitle(n.title, n.url, n.rec.v)}
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                      <Folder className="size-3 shrink-0" />
                      <span className="truncate">{folderPath(n.parent)}</span>
                      {n.rec.v.addedAt ? <span>· {date(n.rec.v.addedAt)}</span> : null}
                      {n.rec.v.notes ? <span className="truncate">· {n.rec.v.notes}</span> : null}
                      {(n.rec.v.tags ?? []).map((tag) => (
                        <span key={tag} className="text-accent">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </button>
                  {isKeep ? (
                    <Badge tone="ok">
                      <Check className="size-3" />
                      {t('dupKept')}
                    </Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => keep(g.key, id)}>
                      {t('dupKeep')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
