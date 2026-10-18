import { browser } from 'wxt/browser';
import type { OAuthTokens } from '../storage/oauth';
import type { RemoteConfig } from '../storage/registry';

export type Lang = 'auto' | 'en' | 'fa' | 'ckb' | 'ar' | 'de' | 'fr' | 'it' | 'pt';
export type Theme = 'system' | 'dark' | 'light';

export interface Settings {
  lang: Lang;
  theme: Theme;
  deviceName: string;
  autoSync: boolean;
  /** Minutes between background syncs. */
  intervalMin: number;
  /** Set once the old 15-minute default has been moved to 1 minute. */
  intervalMigrated?: boolean;
  remote: RemoteConfig | null;
  /** OAuth tokens for Dropbox / Google Drive / OneDrive. */
  tokens: OAuthTokens | null;
  /** Overrides for the built-in OAuth client ids. */
  clientIds: Partial<Record<'dropbox' | 'gdrive' | 'onedrive' | 'github', string>>;
  encryption: { enabled: boolean; key: string };
  /** What happens after a bookmark is made with the browser's own star. */
  afterStar: 'popup' | 'notify' | 'none';
  previews: {
    /** Fetch descriptions + preview images from the pages. */
    fetchMeta: boolean;
    /** Screenshot bookmarked pages when you visit them. */
    autoCapture: boolean;
    /** Upload preview images to the remote storage too. */
    syncImages: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'auto',
  theme: 'system',
  deviceName: '',
  autoSync: true,
  intervalMin: 1,
  remote: null,
  tokens: null,
  clientIds: {},
  encryption: { enabled: false, key: '' },
  afterStar: 'popup',
  previews: { fetchMeta: true, autoCapture: true, syncImages: true },
};

export async function getSettings(): Promise<Settings> {
  const { settings } = (await browser.storage.local.get('settings')) as { settings?: Partial<Settings> };
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    previews: { ...DEFAULT_SETTINGS.previews, ...settings?.previews },
    encryption: { ...DEFAULT_SETTINGS.encryption, ...settings?.encryption },
    clientIds: { ...settings?.clientIds },
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ settings: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && changes.settings) void getSettings().then(cb);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** "Chrome on Windows" style default device name. */
export function guessDeviceName(): string {
  const ua = navigator.userAgent;
  const browserName = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Vivaldi/.test(ua)
        ? 'Vivaldi'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Brave/.test(ua) || (navigator as { brave?: unknown }).brave
            ? 'Brave'
            : 'Chrome';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browserName} · ${os}` : browserName;
}
