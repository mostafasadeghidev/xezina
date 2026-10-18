import { LayoutGrid, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { ConfirmProvider, ToastProvider } from '../components/ui';
import { useLibrary, useRecords, useSettings, useTheme } from '../hooks';
import { I18nProvider, LANGUAGES, resolveLang, useI18n } from '../i18n';
import { Details } from './Details';
import { Home } from './Home';

const managerUrl = (hash = '') => browser.runtime.getURL('/manager.html') + hash;

/** Hands the tab back to the browser's own new tab page, where that is possible. */
async function leaveToBrowserNewTab(): Promise<boolean> {
  if (import.meta.env.FIREFOX) return false;
  const tab = await browser.tabs.getCurrent();
  if (!tab?.id) return false;
  // Addresses of the built-in page that the override does not replace (checked in each browser).
  const brands = (navigator as { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? [];
  const isEdge = /Edg\//.test(navigator.userAgent);
  const isChrome = brands.some((b) => b.brand === 'Google Chrome');
  // Edge silently refuses its own new tab address; the explanation is shown there instead.
  const target = isChrome && !isEdge ? 'chrome://new-tab-page/' : null;
  if (!target) return false;
  try {
    await browser.tabs.update(tab.id, { url: target });
    return true;
  } catch {
    return false;
  }
}

export function NewTabApp() {
  const [settings, , ready] = useSettings();
  useTheme(settings.theme);
  const lang = resolveLang(settings.lang);
  const rtl = LANGUAGES.find((l) => l.code === lang)?.rtl ?? false;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [lang, rtl]);
  useEffect(() => {
    if (ready && !settings.newTab) {
      setLeaving(true);
      // If the browser ignores the navigation, the page is still here: explain instead.
      void leaveToBrowserNewTab().then((ok) => setTimeout(() => setLeaving(false), ok ? 1500 : 0));
    }
  }, [ready, settings.newTab]);
  if (!ready || leaving) return null;
  return (
    <I18nProvider lang={lang}>
      <ToastProvider>
        <ConfirmProvider>{settings.newTab ? <NewTab remote={settings.previews.fetchMeta} /> : <Disabled />}</ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  );
}

function Disabled() {
  const { t } = useI18n();
  return (
    <div className="flex h-screen items-center justify-center p-8 text-center">
      <p className="max-w-md text-sm text-muted">
        {t('newTabDisabled')}{' '}
        <a className="text-accent underline" href={managerUrl('#/settings/general')}>
          {t('navSettings')}
        </a>
      </p>
    </div>
  );
}

function NewTab({ remote }: { remote: boolean }) {
  const { t } = useI18n();
  const lib = useLibrary(useRecords());
  const [details, setDetails] = useState<string | null>(null);
  if (!lib) return null;
  return (
    <div className="relative h-screen">
      <div className="absolute end-4 top-4 z-10 flex gap-1">
        <a href={managerUrl('#/library/all')} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-hover hover:text-fg">
          <LayoutGrid className="size-4" />
          {t('navLibrary')}
        </a>
        <a href={managerUrl('#/settings/general')} className="flex items-center rounded-lg p-2 text-muted hover:bg-hover hover:text-fg" title={t('navSettings')}>
          <SettingsIcon className="size-4" />
        </a>
      </div>
      <Home
        lib={lib}
        openDetails={setDetails}
        remote={remote}
        sameTab
        showAll={(q) => {
          location.href = managerUrl(`#q=${encodeURIComponent(q)}`);
        }}
      />
      {details && <Details lib={lib} id={details} onClose={() => setDetails(null)} remote={remote} />}
    </div>
  );
}
