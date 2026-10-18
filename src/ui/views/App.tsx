import { useCallback, useEffect, useState } from 'react';
import { ROOT } from '../../core/types';
import { ConfirmProvider, Spinner, ToastProvider } from '../components/ui';
import { useHashRoute, useLibrary, useRecords, useSettings, useTheme } from '../hooks';
import { I18nProvider, LANGUAGES, resolveLang } from '../i18n';
import { parseRoute } from '../library';
import { Dashboard } from './Dashboard';
import { QuickSearch } from './QuickSearch';
import { AddDialog, Details, FolderDialog } from './Details';
import { LibraryView } from './Library';
import { SettingsView } from './Settings';
import { Sidebar } from './Sidebar';
import { send } from '../../lib/messages';

export function App() {
  const [settings, , ready] = useSettings();
  useTheme(settings.theme);
  const lang = resolveLang(settings.lang);
  const rtl = LANGUAGES.find((l) => l.code === lang)?.rtl ?? false;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl]);
  if (!ready) return null;
  return (
    <I18nProvider lang={lang}>
      <ToastProvider>
        <ConfirmProvider>
          <Shell remote={settings.previews.fetchMeta} />
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  );
}

function Shell({ remote }: { remote: boolean }) {
  const records = useRecords();
  const lib = useLibrary(records);
  const [route, go] = useHashRoute();
  const [path, search] = route.split('?');
  const { page, filter, tab } = parseRoute(path);
  const [query, setQuery] = useState(() => new URLSearchParams(location.hash.split('#q=')[1] ? `q=${location.hash.split('#q=')[1]}` : '').get('q') ?? '');
  const [details, setDetails] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newFolderIn, setNewFolderIn] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);

  // Ctrl+K / Cmd+K opens the floating search from anywhere in Xezina.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuick((q) => !q);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  useEffect(() => {
    // The omnibox opens "manager.html#q=…".
    if (location.hash.startsWith('#q=')) go('/library/all');
    // Make sure the library reflects the browser right away.
    void send({ type: 'scan' }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "#/library/all?edit=<id>" (from a notification) opens that bookmark's details.
  useEffect(() => {
    const id = new URLSearchParams(search ?? '').get('edit');
    if (id) {
      setDetails(id);
      go(path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const goAndReset = useCallback(
    (r: string) => {
      go(r);
    },
    [go],
  );

  if (!lib) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar lib={lib} filter={filter} page={page} go={goAndReset} onNewFolder={setNewFolderIn} onQuickSearch={() => setQuick(true)} />
      <main className="min-w-0 flex-1">
        {page === 'library' && (
          <LibraryView
            lib={lib}
            filter={filter}
            query={query}
            setQuery={setQuery}
            go={goAndReset}
            openDetails={setDetails}
            onAdd={() => setAdding(true)}
            remote={remote}
          />
        )}
        {page === 'dashboard' && <Dashboard lib={lib} go={goAndReset} />}
        {page === 'settings' && <SettingsView tab={tab ?? 'general'} go={goAndReset} lib={lib} />}
      </main>
      <QuickSearch
        lib={lib}
        open={quick}
        onClose={() => setQuick(false)}
        openDetails={setDetails}
        remote={remote}
        showAll={(q) => {
          setQuery(q);
          go('/library/all');
        }}
      />
      {details && <Details lib={lib} id={details} onClose={() => setDetails(null)} remote={remote} />}
      <AddDialog lib={lib} open={adding} onClose={() => setAdding(false)} folder={filter.kind === 'folder' ? filter.id : ROOT.other} />
      <FolderDialog open={!!newFolderIn} parent={newFolderIn ?? ROOT.other} onClose={() => setNewFolderIn(null)} />
    </div>
  );
}
