import { browser } from 'wxt/browser';
import { buildTree } from '../core/tree';
import { displayTitle } from '../core/normalize';
import { buildIndex, searchIds } from '../core/search';
import type { State } from '../core/types';
import { db } from '../db/db';
import type { Message, Reply } from '../lib/messages';
import {
  capture,
  connectOAuth,
  createBackup,
  createNative,
  editNative,
  editTags,
  enrich,
  fetchBlob,
  forgetDevice,
  githubFinish,
  githubStart,
  maybeAutoCapture,
  onBrowserBookmarked,
  onNotificationClicked,
  onWindowFocused,
  setImporting,
  moveNative,
  onBookmarkEvent,
  removeNative,
  reschedule,
  restoreBackup,
  scheduleEnrich,
  setEncryption,
  setImage,
  setMeta,
  setRemote,
  stopEnrich,
  sync,
  testRemote,
  getStatus,
} from '../background/service';

async function handle(msg: Message): Promise<unknown> {
  switch (msg.type) {
    case 'sync':
      return sync({ mode: msg.mode, allowMassDelete: msg.allowMassDelete });
    case 'scan':
      return sync({ localOnly: true });
    case 'meta':
      return setMeta(msg.ids, msg.patch);
    case 'tags':
      return editTags(msg.ids, msg.add, msg.remove);
    case 'edit':
      return editNative(msg.id, { title: msg.title, url: msg.url });
    case 'move':
      return moveNative(msg.ids, msg.parent, msg.index);
    case 'create': {
      const id = await createNative(msg.parent, msg.title, msg.url, msg.index);
      if (id && msg.url) void enrich([id]).catch(() => undefined);
      return id;
    }
    case 'remove':
      return removeNative(msg.ids);
    case 'enrich':
      void enrich(msg.ids, msg.force).catch(() => undefined);
      return true;
    case 'enrich:stop':
      stopEnrich();
      return true;
    case 'capture':
      return capture(msg.windowId, msg.id);
    case 'blob:fetch':
      return fetchBlob(msg.hash);
    case 'image:set':
      return setImage(msg.id, msg.dataUrl);
    case 'remote:test':
      return testRemote(msg.config);
    case 'remote:set':
      return setRemote(msg.config);
    case 'oauth:connect':
      return connectOAuth(msg.provider);
    case 'github:device-start':
      return githubStart();
    case 'github:device-finish':
      return githubFinish(msg.code);
    case 'encryption:set':
      return setEncryption(msg.passphrase);
    case 'backup:create':
      return createBackup();
    case 'backup:restore':
      return restoreBackup(msg.id);
    case 'remote:devices':
      return (await getStatus()).devices;
    case 'remote:forget-device':
      return forgetDevice(msg.deviceId);
    case 'reschedule':
      return reschedule();
  }
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

function openManager(query = '') {
  const url = browser.runtime.getURL('/manager.html') + (query ? `#q=${encodeURIComponent(query)}` : '');
  void browser.tabs.create({ url });
}

export default defineBackground(() => {
  const isFirefox = import.meta.env.FIREFOX;

  browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    handle(msg as Message).then(
      (data) => sendResponse({ ok: true, data: data ?? null } satisfies Reply),
      (e: Error) => sendResponse({ ok: false, error: e?.message ?? String(e) } satisfies Reply),
    );
    return true;
  });

  browser.bookmarks.onCreated.addListener((id, node) => {
    if (node.url) void onBrowserBookmarked(id, node.url).catch(() => undefined);
  });
  browser.notifications?.onClicked.addListener(onNotificationClicked);
  browser.bookmarks.onImportBegan?.addListener(() => setImporting(true));
  browser.bookmarks.onImportEnded?.addListener(() => setImporting(false));

  for (const ev of [
    browser.bookmarks.onCreated,
    browser.bookmarks.onRemoved,
    browser.bookmarks.onChanged,
    browser.bookmarks.onMoved,
    browser.bookmarks.onChildrenReordered,
    browser.bookmarks.onImportEnded,
  ]) {
    (ev as { addListener(cb: () => void): void } | undefined)?.addListener(() => onBookmarkEvent());
  }

  // Unpacked installs updated with "pnpm local": reload when a new build lands in the folder.
  // The stamp of the running build is kept in storage, because the service worker sleeps.
  const diskBuild = async (): Promise<string | null> => {
    try {
      const res = await fetch(browser.runtime.getURL('/build.json' as '/manager.html'), { cache: 'no-store' });
      return res.ok ? String((await res.json()).builtAt) : null;
    } catch {
      return null;
    }
  };
  const checkLocalBuild = async () => {
    const onDisk = await diskBuild();
    if (!onDisk) return;
    const { loadedBuild } = (await browser.storage.local.get('loadedBuild')) as { loadedBuild?: string };
    if (!loadedBuild) await browser.storage.local.set({ loadedBuild: onDisk });
    else if (loadedBuild !== onDisk) {
      await browser.storage.local.set({ loadedBuild: onDisk });
      browser.runtime.reload();
    }
  };
  browser.runtime.onInstalled.addListener(() => {
    void diskBuild().then(async (b) => {
      if (b) await browser.storage.local.set({ loadedBuild: b });
    });
  });
  void diskBuild().then((b) => {
    if (b) void browser.alarms.create('xezina-local-build', { periodInMinutes: 1 });
  });
  void checkLocalBuild();

  browser.windows?.onFocusChanged.addListener((windowId) => {
    if (windowId !== browser.windows.WINDOW_ID_NONE) void onWindowFocused();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'xezina-local-build') void checkLocalBuild();
    if (alarm.name === 'xezina-sync') void sync().catch(() => undefined);
    if (alarm.name === 'xezina-enrich') scheduleEnrich(1000);
  });

  const start = async () => {
    await reschedule();
    await sync({ localOnly: true }).catch(() => undefined);
    scheduleEnrich(20_000);
  };
  browser.runtime.onStartup.addListener(() => void start());
  browser.runtime.onInstalled.addListener((details) => {
    void start();
    if (details.reason === 'install') openManager();
  });

  browser.tabs.onUpdated.addListener((_id, info, tab) => {
    if (info.status === 'complete') void maybeAutoCapture(tab).catch(() => undefined);
  });

  browser.commands?.onCommand.addListener((cmd) => {
    if (cmd === 'open-manager') openManager();
  });

  // Address-bar search: type "bm" + space + words.
  let index: { at: number; search: (q: string) => { id: string; title: string; url: string }[] } | null = null;
  const getIndex = async () => {
    if (index && Date.now() - index.at < 30_000) return index;
    const all = await db.records.toArray();
    const tree = buildTree(Object.fromEntries(all.map((r) => [r.id, r])) as State);
    const mini = buildIndex(tree);
    index = {
      at: Date.now(),
      search: (q) =>
        searchIds(mini, q, 8).map((id) => {
          const n = tree.byId.get(id)!;
          return { id, title: displayTitle(n.title, n.url, n.rec.v), url: n.url };
        }),
    };
    return index;
  };
  // The hint the address bar shows after "bm ", in the user's language.
  void (async () => {
    const { getSettings } = await import('../lib/settings');
    const { makeI18n, resolveLang } = await import('../ui/i18n');
    const { t } = makeI18n(resolveLang((await getSettings()).lang));
    browser.omnibox?.setDefaultSuggestion({ description: `Xezina — ${t('popupSearch')}` });
  })();
  browser.omnibox?.onInputChanged.addListener(async (text, suggest) => {
    const hits = (await getIndex()).search(text);
    suggest(
      hits.map((h) => ({
        content: h.url,
        description: isFirefox ? `${h.title} — ${h.url}` : `${escapeXml(h.title)} <url>${escapeXml(h.url)}</url>`,
      })),
    );
  });
  browser.omnibox?.onInputEntered.addListener(async (text, disposition) => {
    let url = text;
    if (!/^[a-z]+:\/\//i.test(text)) {
      const [first] = (await getIndex()).search(text);
      if (!first) return openManager(text);
      url = first.url;
    }
    if (disposition === 'currentTab') void browser.tabs.update({ url });
    else void browser.tabs.create({ url, active: disposition === 'newForegroundTab' });
  });
});
