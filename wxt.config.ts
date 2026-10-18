import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: [
      'bookmarks',
      'storage',
      'unlimitedStorage',
      'alarms',
      'identity',
      'activeTab',
      'notifications',
      ...(browser === 'firefox' ? [] : ['favicon', 'declarativeNetRequestWithHostAccess']),
    ],
    // Requested at runtime only when the user enables previews, link checks or a remote storage.
    optional_host_permissions: ['<all_urls>'],
    host_permissions: [
      'https://api.github.com/*',
      'https://api.dropboxapi.com/*',
      'https://content.dropboxapi.com/*',
      'https://www.googleapis.com/*',
      'https://oauth2.googleapis.com/*',
      'https://graph.microsoft.com/*',
      'https://login.microsoftonline.com/*',
      'https://github.com/login/*',
      // Test builds only (XEZINA_E2E=1): page access granted up front so previews can be tested.
      ...(process.env.XEZINA_E2E ? ['<all_urls>'] : []),
    ],
    omnibox: { keyword: 'bm' },
    commands: {
      [browser === 'firefox' ? '_execute_browser_action' : '_execute_action']: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Save the current page with notes',
      },
      'open-manager': {
        suggested_key: { default: 'Alt+Shift+B' },
        description: 'Open the bookmark manager',
      },
    },
    icons: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png', 96: '/icon/96.png', 128: '/icon/128.png' },
    action: {
      default_title: 'Xezina',
      default_icon: { 16: '/icon/16.png', 32: '/icon/32.png', 48: '/icon/48.png' },
    },
    ...(browser === 'firefox'
      ? {
          // MV2: optional host access is declared as an optional permission.
          optional_permissions: ['<all_urls>'],
          browser_specific_settings: {
            gecko: { id: 'xezina@mostafasadeghidev.github.io', strict_min_version: '115.0' },
          },
        }
      : {}),
  }),
});
