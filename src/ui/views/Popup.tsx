import { BookmarkPlus, Camera, ExternalLink, LayoutDashboard, Search, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { hostOf, normalizeUrl } from '../../core/normalize';
import { searchIds } from '../../core/search';
import { ROOT } from '../../core/types';
import { send } from '../../lib/messages';
import { Favicon, FolderSelect, TagInput, useFolderName } from '../components/bits';
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
  const [newId, setNewId] = useState<string | null>(null);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([t0]) => {
      if (t0?.id !== undefined && t0.url) setTab({ id: t0.id, windowId: t0.windowId, url: t0.url, title: t0.title ?? '' });
    });
  }, []);

  const existing = useMemo(() => {
    if (!lib || !tab) return undefined;
    if (newId) return lib.tree.byId.get(newId);
    const key = normalizeUrl(tab.url);
    return lib.bookmarks.find((b) => normalizeUrl(b.url) === key);
  }, [lib, tab, newId]);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setNotes(existing.rec.v.notes ?? '');
      setTags(existing.rec.v.tags ?? []);
      setParent(existing.parent);
    } else if (tab) {
      setTitle(tab.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, tab]);

  const hits = useMemo(() => {
    if (!lib || !query.trim()) return [];
    return searchIds(lib.index, query, 8)
      .map((id) => lib.tree.byId.get(id)!)
      .filter(Boolean);
  }, [lib, query]);

  const bookmarkable = !!tab && /^(https?|ftp|file):/i.test(tab.url);

  const save = async () => {
    if (!tab) return;
    setBusy(true);
    try {
      if (existing) {
        if (title !== existing.title) await send({ type: 'edit', id: existing.id, title });
        await send({ type: 'meta', ids: [existing.id], patch: { notes, tags } });
        if (parent !== existing.parent) await send({ type: 'move', ids: [existing.id], parent });
        toast(t('saved'));
      } else {
        const id = await send<string | null>({ type: 'create', parent, title: title || tab.url, url: tab.url });
        if (id) {
          setNewId(id);
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
            autoFocus
            className="h-8 w-full rounded-lg border border-line bg-card pe-2 ps-8 text-[13px] outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hits[0]) void browser.tabs.create({ url: hits[0].url });
            }}
          />
        </div>
        <IconButton label={t('popupOpenManager')} onClick={() => openManager()}>
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
                <span className="block truncate text-[13px] font-medium">{h.title || hostOf(h.url)}</span>
                <span className="block truncate text-[11px] text-muted">{h.rec.v.notes || hostOf(h.url)}</span>
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
          <div className="flex items-center gap-2">
            <Favicon url={tab!.url} size={20} remote={remote} />
            <span className="ltr min-w-0 flex-1 truncate text-start text-xs text-muted">{hostOf(tab!.url)}</span>
            {existing && (
              <>
                <IconButton
                  label={existing.rec.v.fav ? t('unfavorite') : t('favorite')}
                  onClick={() => void send({ type: 'meta', ids: [existing.id], patch: { fav: !existing.rec.v.fav } })}
                >
                  <Star className={cx('size-4', existing.rec.v.fav && 'fill-yellow-400 text-yellow-400')} />
                </IconButton>
                <IconButton
                  label={t('popupCapture')}
                  onClick={() =>
                    void send({ type: 'capture', tabId: tab!.id, windowId: tab!.windowId, id: existing.id })
                      .then(() => toast(t('done')))
                      .catch((e) => toast(e.message, 'error'))
                  }
                >
                  <Camera className="size-4" />
                </IconButton>
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="!h-9" />
          <FolderSelect tree={lib.tree} value={parent} onChange={setParent} />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notesPlaceholder')} rows={3} className="!min-h-20 text-[13px]" />
          <TagInput value={tags} onChange={setTags} suggestions={lib.tags.map(([x]) => x)} placeholder={t('tagsPlaceholder')} />
          <div className="flex items-center gap-2 pt-1">
            <Button variant="primary" className="flex-1" loading={busy} icon={<BookmarkPlus className="size-4" />} onClick={() => void save()}>
              {existing ? t('save') : t('popupSave')}
            </Button>
            {existing && (
              <Button onClick={() => openManager()} icon={<ExternalLink className="size-4" />}>
                {t('popupOpenManager')}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
