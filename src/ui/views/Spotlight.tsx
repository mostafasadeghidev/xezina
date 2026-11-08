import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { useLibrary, useRecords, useSettings, useTheme } from '../hooks';
import { I18nProvider, LANGUAGES, resolveLang } from '../i18n';
import { QuickSearch } from './QuickSearch';

/**
 * The search Alt+Shift+D opens on any page: a frame over the page, or a small
 * window where pages can't be touched (the browser's own pages, the web store).
 * "?tab=" is the tab it was opened from; "&win=1" means it is a window.
 */
const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tab')) || undefined;
const inWindow = params.has('win');

function close() {
  if (inWindow) window.close();
  else window.parent.postMessage('xezina:spotlight:close', '*');
}

export function SpotlightApp() {
  const [settings, , ready] = useSettings();
  useTheme(settings.theme);
  const lang = resolveLang(settings.lang);
  const rtl = LANGUAGES.find((l) => l.code === lang)?.rtl ?? false;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl]);
  useEffect(() => {
    // Like Spotlight: clicking elsewhere puts the window away.
    if (inWindow) window.addEventListener('blur', close);
  }, []);
  if (!ready) return null;
  return (
    <I18nProvider lang={lang}>
      <Search remote={settings.previews.fetchMeta} />
    </I18nProvider>
  );
}

function Search({ remote }: { remote: boolean }) {
  const lib = useLibrary(useRecords());
  if (!lib) return null;
  const manager = (hash: string) => void browser.tabs.create({ url: browser.runtime.getURL('/manager.html') + hash });
  return (
    <QuickSearch
      lib={lib}
      open
      onClose={close}
      remote={remote}
      window={inWindow}
      // A new tab by default, so the page you were on stays; Ctrl+Enter replaces it.
      onPick={(n, ctrl) => {
        if (ctrl && tabId !== undefined) void browser.tabs.update(tabId, { url: n.url });
        else void browser.tabs.create({ url: n.url, openerTabId: tabId });
      }}
      openDetails={(id) => manager(`#/library/all?edit=${encodeURIComponent(id)}`)}
      showAll={(q) => manager(`#q=${encodeURIComponent(q)}`)}
    />
  );
}
