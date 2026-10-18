import { BookmarkPlus, Camera, Check, ExternalLink, LayoutDashboard, Search, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { displayTitle, hostOf, normalizeUrl } from '../../core/normalize';
import { searchIds } from '../../core/search';
import { ROOT } from '../../core/types';
import { db } from '../../db/db';
import { send } from '../../lib/messages';
import { Favicon, FolderSelect, Hl, TagInput, useFolderName } from '../components/bits';
import { Button, cx, IconButton, Input, Textarea, ToastProvider, useToast } from '../components/ui';
import { useLibrary, useRecords, useSettings, useTheme } from '../hooks';
import { I18nProvider, LANGUAGES, resolveLang, useI18n } from '../i18n';
import { Logo } from './Logo';

export function PopupApp() {
  const [settings, , ready] = useSettings();
  useTheme(settings.theme);
  const lang = resolveLang(settings.lang);
  const rtl = LANGUAGES.find((l) => l.code === lang)?.rtl ?? false;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl]);
  if (!ready) return <div className="h-40 w-[380px]" />;
  return (
    <I18nProvider lang={lang}>
      <ToastProvider>
        <Popup remote={settings.previews.fetchMeta} />
      </ToastProvider>
    </I18nProvider>
  );
}

interface TabInfo {
  id: number;
  windowId: number;
  url: string;
  title: string;
}

function Popup({ remote }: { remote: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const name = useFolderName();
  const records = useRecords();
  const lib = useLibrary(records);
  const [tab, setTab] = useState<TabInfo | null>(null);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [parent, setParent] = useState<string>(() => {
    try {
      return localStorage.getItem('xz.lastFolder') || ROOT.other;
    } catch {
      return ROOT.other;
    }
  });
  const [busy, setBusy] = useState(false);
  // Save a screenshot of the page as its preview (remembered).
  const [shot, setShot] = useState<boolean>(() => {
    try {
      return localStorage.getItem('xz.saveShot') !== '0';
    } catch {
      return true;
    }
  });
  const [newId, setNewId] = useState<string | null>(null);
  /** Set when Xezina opened this window right after the browser's star was used. */
  const [starId, setStarId] = useState<string | null>(null);

  useEffect(() => {
    void db.kv.get('lastStar').then((row) => {
      const v = row?.value as { id: string; at: number } | undefined;
      if (v && Date.now() - v.at < 60_000) setStarId(v.id);
      if (v) void db.kv.delete('lastStar');
    });
  }, []);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([t0]) => {
      if (t0?.id !== undefined && t0.url) setTab({ id: t0.id, windowId: t0.windowId, url: t0.url, title: t0.title ?? '' });
    });
  }, []);

  const existing = useMemo(() => {
    if (!lib) return undefined;
    if (starId && lib.tree.byId.has(starId)) return lib.tree.byId.get(starId);
    if (!tab) return undefined;
    if (newId) return lib.tree.byId.get(newId);
    const key = normalizeUrl(tab.url);
    return lib.bookmarks.find((b) => normalizeUrl(b.url) === key);
  }, [lib, tab, newId]);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setUrl(existing.url);
      setNotes(existing.rec.v.notes ?? '');
      setTags(existing.rec.v.tags ?? []);
      setParent(existing.parent);
    } else if (tab) {
      setTitle(tab.title);
      setUrl(tab.url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, tab]);

  const hits = useMemo(() => {
    if (!lib || !query.trim()) return [];
    return searchIds(lib.index, query, 8)
      .map((id) => lib.tree.byId.get(id)!)
      .filter(Boolean);
  }, [lib, query]);

  const pageUrl = url || existing?.url || tab?.url || '';
  // Unchanged since it was saved: the button says so.
  const dirty =
    !existing ||
    title !== existing.title ||
    url.trim() !== existing.url ||
    notes !== (existing.rec.v.notes ?? '') ||
    parent !== existing.parent ||
    JSON.stringify(tags) !== JSON.stringify(existing.rec.v.tags ?? []);
  const bookmarkable = !!existing || (!!tab && /^(https?|ftp|file):/i.test(tab.url));

  const save = async () => {
    if (!tab && !existing) return;
    setBusy(true);
    try {
      if (existing) {
        const newUrl = url.trim();
        if (title !== existing.title || (newUrl && newUrl !== existing.url))
          await send({ type: 'edit', id: existing.id, title, url: newUrl && newUrl !== existing.url ? newUrl : undefined });
        // Keep showing this bookmark even if its address no longer matches the tab.
        setNewId(existing.id);
        if (shot && tab && existing.rec.v.imgSrc !== 'shot' && existing.rec.v.imgSrc !== 'user') await takeShot(existing.id);
        await send({ type: 'meta', ids: [existing.id], patch: { notes, tags } });
        if (parent !== existing.parent) await send({ type: 'move', ids: [existing.id], parent });
        toast(t('saved'));
        // Opened by the star: done after saving.
        if (starId) setTimeout(() => window.close(), 600);
      } else {
        const target = url.trim() || tab!.url;
        const id = await send<string | null>({ type: 'create', parent, title: title || target, url: target });
        if (id) {
          setNewId(id);
          if (shot) await takeShot(id);
          if (notes || tags.length) await send({ type: 'meta', ids: [id], patch: { notes, tags } });
        }
        try {
          localStorage.setItem('xz.lastFolder', parent);
        } catch {
          // ignore
        }
        toast(t('popupSaved', { folder: name(lib?.tree.byId.get(parent)) }));
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  /** Screenshot of the page behind this popup; allowed because the user opened the popup. */
  const takeShot = async (id: string) => {
    if (!tab || !/^https?:/i.test(tab.url)) return;
    try {
      await send({ type: 'capture', tabId: tab.id, windowId: tab.windowId, id });
    } catch {
      // e.g. opened automatically after the star without page access
    }
  };

  /** Opens the folder that holds a bookmark and points at it. */
  const focusHash = (folder: string, id: string) => `#/folder/${encodeURIComponent(folder)}?focus=${encodeURIComponent(id)}`;

  const openManager = (hash = '') => {
    void browser.tabs.create({ url: browser.runtime.getURL('/manager.html') + hash });
    window.close();
  };

  return (
    <div className="w-[380px] bg-bg text-fg">
      <header className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2.5">
        <Logo className="size-6" />
        <span className="font-bold">Xezina</span>
        <div className="relative ms-2 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('popupSearch')}
            autoFocus={!starId}
            className="h-8 w-full rounded-lg border border-line bg-card pe-2 ps-8 text-[13px] outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hits[0]) void browser.tabs.create({ url: hits[0].url });
            }}
          />
        </div>
        <IconButton label={t('popupOpenManager')} onClick={() => openManager(existing ? focusHash(existing.parent, existing.id) : '')}>
          <LayoutDashboard className="size-4" />
        </IconButton>
      </header>

      {query.trim() ? (
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {hits.length === 0 && <p className="p-4 text-center text-sm text-muted">{t('noResults')}</p>}
          {hits.map((h) => (
            <a key={h.id} href={h.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-hover">
              <Favicon url={h.url} remote={remote} />
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-[13px] font-medium">
                  <Hl text={displayTitle(h.title, h.url, h.rec.v)} query={query} />
                </span>
                <span className="block truncate text-[11px] text-muted">
                  <Hl text={h.rec.v.notes || hostOf(h.url)} query={query} />
                </span>
              </span>
            </a>
          ))}
          {hits.length > 0 && (
            <button onClick={() => openManager(`#q=${encodeURIComponent(query)}`)} className="mt-1 w-full rounded-lg py-2 text-center text-xs text-accent hover:bg-hover">
              {t('popupOpenManager')} →
            </button>
          )}
        </div>
      ) : !bookmarkable ? (
        <p className="p-6 text-center text-sm text-muted">{t('popupNotPage')}</p>
      ) : lib ? (
        <div className="space-y-3 p-3">
          {starId && existing && (
            <div className="flex items-center gap-2 rounded-lg bg-ok/10 px-3 py-2 text-[13px] text-ok">
              <Star className="size-4 fill-current" />
              {t('starSavedTitle')}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Favicon url={pageUrl} size={20} remote={remote} />
            <span className="ltr min-w-0 flex-1 truncate text-start text-xs text-muted">{hostOf(pageUrl)}</span>
            {existing && (
              <>
                <IconButton
                  label={existing.rec.v.fav ? t('unfavorite') : t('favorite')}
                  onClick={() => void send({ type: 'meta', ids: [existing.id], patch: { fav: !existing.rec.v.fav } })}
                >
                  <Star className={cx('size-4', existing.rec.v.fav && 'fill-yellow-400 text-yellow-400')} />
                </IconButton>
                {tab ? (
                  <IconButton
                    label={existing.rec.v.imgSrc === 'shot' ? t('hasScreenshot') : t('popupCapture')}
                    className={cx('relative', existing.rec.v.imgSrc === 'shot' && '!text-ok')}
                    onClick={() =>
                      void send({ type: 'capture', tabId: tab.id, windowId: tab.windowId, id: existing.id })
                        .then(() => toast(t('done')))
                        .catch((e) => toast(e.message, 'error'))
                    }
                  >
                    <Camera className="size-4" />
                    {existing.rec.v.imgSrc === 'shot' && <span className="absolute end-1 top-1 size-1.5 rounded-full bg-ok" />}
                  </IconButton>
                ) : (
                  existing.rec.v.imgSrc === 'shot' && (
                    <span className="relative flex size-8 items-center justify-center text-ok" title={t('hasScreenshot')}>
                      <Camera className="size-4" />
                      <span className="absolute end-1 top-1 size-1.5 rounded-full bg-ok" />
                    </span>
                  )
                )}
                <IconButton
                  label={t('popupRemove')}
                  className="hover:text-danger"
                  onClick={() =>
                    void send({ type: 'remove', ids: [existing.id] }).then(() => {
                      setNewId(null);
                      window.close();
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </>
            )}
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="!h-9" dir="auto" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} className="!h-9 text-[12.5px]" dir="ltr" spellCheck={false} />
          <FolderSelect tree={lib.tree} value={parent} onChange={setParent} />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notesPlaceholder')}
            rows={3}
            autoFocus={!!starId}
            className="!min-h-20 text-[13px]"
          />
          <TagInput value={tags} onChange={setTags} suggestions={lib.tags.map(([x]) => x)} placeholder={t('tagsPlaceholder')} />
          {tab && /^https?:/i.test(tab.url) && (!existing || dirty || (existing.rec.v.imgSrc !== 'shot' && existing.rec.v.imgSrc !== 'user')) && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={shot}
                onChange={(e) => {
                  setShot(e.target.checked);
                  try {
                    localStorage.setItem('xz.saveShot', e.target.checked ? '1' : '0');
                  } catch {
                    // ignore
                  }
                }}
                className="size-4 accent-[var(--accent)]"
              />
              <Camera className="size-3.5" />
              {t('withScreenshot')}
            </label>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              className={cx('flex-1', !dirty && '!bg-ok/15 !text-ok !shadow-none')}
              loading={busy}
              disabled={!dirty}
              icon={!dirty ? <Check className="size-4" /> : <BookmarkPlus className="size-4" />}
              onClick={() => void save()}
            >
              {!dirty ? t('savedState') : existing ? t('saveChanges') : t('popupSave')}
            </Button>
            {existing && (
              <Button onClick={() => openManager(focusHash(existing.parent, existing.id))} icon={<ExternalLink className="size-4" />}>
                {t('popupOpenManager')}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
