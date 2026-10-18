import { browser } from 'wxt/browser';
import { Clock } from '../core/clock';
import { cloneState, newRecord, setField, setFields } from '../core/crdt';
import { normalizeUrl, uniqueTags } from '../core/normalize';
import { buildTree } from '../core/tree';
import { isRoot, type FieldValues, type Rec, type State } from '../core/types';
import { db, DEFAULT_STATUS, kvGet, kvSet, loadDevice, saveDevice, type EnrichStatus, type SyncStatus } from '../db/db';
import { dataUrlToBlob, downloadImage, hashBlob, makePreview } from '../enrich/images';
import { fetchPage, isProtectedPage } from '../enrich/metadata';
import { getSettings, guessDeviceName, saveSettings, type Settings } from '../lib/settings';
import { ensureRepo, githubDevicePoll, githubDeviceStart, githubUser, type DeviceCode } from '../storage/github';
import { BUILT_IN_CLIENT_IDS, signIn, tokenSource } from '../storage/oauth';
import { createRemote, isOAuth, type RemoteConfig } from '../storage/registry';
import type { RemoteStorage } from '../storage/types';
import { decodeBytes, deriveKey, encodeBytes, exportKey, fromBase64, importKey, NeedsKeyError, PBKDF2_ITERATIONS, toBase64 } from '../sync/codec';
import { DEVICES_DIR, makeCheck, readMeta, runSync, verifyCheck, writeMeta, type SyncMode, type SyncReport } from '../sync/engine';
import { newId, type DeviceData } from '../sync/local';
import { MassDeleteError } from '../sync/materialize';
import { nativeApi } from './native-api';

// ---------------------------------------------------------------- locking

let chain: Promise<unknown> = Promise.resolve();
/** Runs `fn` after every earlier locked task: one writer at a time. */
export function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

/** True while Xezina itself is changing bookmarks (so its own events are ignored). */
export let applying = false;

// ---------------------------------------------------------------- status

export async function getStatus(): Promise<SyncStatus> {
  return kvGet('status', DEFAULT_STATUS);
}

async function setStatus(patch: Partial<SyncStatus>) {
  const next = { ...(await getStatus()), ...patch };
  await kvSet('status', next);
  await updateBadge(next);
  return next;
}

async function updateBadge(s: SyncStatus) {
  const text = s.state === 'error' || s.state === 'needs-key' ? '!' : s.state === 'confirm' ? '?' : '';
  const action = browser.action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction;
  try {
    await action.setBadgeText({ text });
    if (text) await action.setBadgeBackgroundColor({ color: s.state === 'confirm' ? '#d97706' : '#dc2626' });
  } catch {
    // ignore (e.g. Firefox Android)
  }
}

async function log(ok: boolean, mode: string, message: string, ms: number, report?: SyncReport) {
  await db.logs.add({ at: Date.now(), ok, mode, message, ms, report });
  const count = await db.logs.count();
  if (count > 300) {
    const old = await db.logs.orderBy('at').limit(count - 300).primaryKeys();
    await db.logs.bulkDelete(old);
  }
}

// ---------------------------------------------------------------- remote

async function remoteFor(settings: Settings): Promise<RemoteStorage | null> {
  const cfg = settings.remote;
  if (!cfg) return null;
  if (isOAuth(cfg.type)) {
    if (!settings.tokens) throw new Error('Not signed in — reconnect the storage in Settings → Sync.');
    const clientId = settings.clientIds[cfg.type] || BUILT_IN_CLIENT_IDS[cfg.type];
    const tokens = tokenSource(cfg.type, clientId, settings.tokens, async (t) => {
      await saveSettings({ tokens: t });
    });
    return createRemote(cfg, tokens);
  }
  return createRemote(cfg);
}

async function keyFor(settings: Settings): Promise<CryptoKey | null> {
  return settings.encryption.enabled && settings.encryption.key ? importKey(settings.encryption.key) : null;
}

/** Makes sure the remote's meta file agrees with our encryption settings. */
async function checkMeta(remote: RemoteStorage, key: CryptoKey | null) {
  const meta = await readMeta(remote);
  if (!meta) {
    if (key) throw new Error('The storage is missing its encryption settings; turn encryption off and on again.');
    await writeMeta(remote, { app: 'xezina', format: 1, encryption: null });
    return;
  }
  if (meta.encryption) {
    if (!key || !(await verifyCheck(meta.encryption.check, key))) throw new NeedsKeyError();
  }
}

// ---------------------------------------------------------------- sync

async function deviceInfo() {
  const s = await getSettings();
  return { name: s.deviceName || guessDeviceName(), browser: guessDeviceName().split(' · ')[0] };
}

async function backup(state: State, reason: string) {
  const tree = buildTree(state);
  const count = [...tree.byId.values()].filter((n) => n.kind === 'bookmark').length;
  if (!count) return;
  await db.backups.add({ at: Date.now(), reason, count, state });
  const all = await db.backups.orderBy('at').primaryKeys();
  if (all.length > 30) await db.backups.bulkDelete(all.slice(0, all.length - 30));
}

function engineDeps() {
  let before: State | undefined;
  return {
    native: nativeApi,
    load: async () => {
      const d = await loadDevice();
      before = cloneState(d.state);
      return d;
    },
    save: async (d: DeviceData) => {
      await saveDevice(d, before);
      before = cloneState(d.state);
    },
    backup,
    device: deviceInfo,
  };
}

export interface SyncRequest {
  mode?: SyncMode;
  allowMassDelete?: boolean;
  /** Only read local changes; never touch the network. */
  localOnly?: boolean;
}

/** Runs one sync round (or a local-only scan) and records the outcome. */
export function sync(req: SyncRequest = {}): Promise<SyncReport | null> {
  return locked(async () => {
    const settings = await getSettings();
    const t0 = Date.now();
    let remote: RemoteStorage | null = null;
    const mode = req.mode ?? 'normal';
    if (!req.localOnly) {
      try {
        remote = await remoteFor(settings);
      } catch (e) {
        await setStatus({ state: 'error', lastError: (e as Error).message });
        throw e;
      }
      if (remote) await setStatus({ state: 'running', lastError: '' });
    }
    applying = true;
    try {
      const key = await keyFor(settings);
      if (remote) await checkMeta(remote, key);
      const report = await runSync(engineDeps(), {
        remote,
        key,
        mode,
        allowMassDelete: req.allowMassDelete,
      });
      if (remote) {
        await setStatus({ state: 'idle', lastSync: Date.now(), lastError: '', pendingDeletes: undefined, devices: report.devices.length ? report.devices : (await getStatus()).devices });
        await log(true, mode, summary(report), Date.now() - t0, report);
        if (settings.previews.syncImages) void uploadBlobs(remote, key).catch(() => undefined);
      }
      return report;
    } catch (e) {
      if (e instanceof MassDeleteError) {
        await setStatus({ state: 'confirm', pendingDeletes: { count: e.count, total: e.total }, lastError: e.message });
      } else if (e instanceof NeedsKeyError) {
        await setStatus({ state: 'needs-key', lastError: e.message });
      } else if (remote) {
        await setStatus({ state: 'error', lastError: (e as Error).message });
      }
      if (remote) await log(false, mode, (e as Error).message, Date.now() - t0);
      if (req.localOnly && e instanceof MassDeleteError) return null;
      throw e;
    } finally {
      applying = false;
    }
  });
}

function summary(r: SyncReport): string {
  const a = r.applied;
  const parts: string[] = [];
  if (r.localChanges) parts.push(`${r.localChanges} local`);
  if (r.remoteChanges) parts.push(`${r.remoteChanges} remote`);
  if (a.created || a.updated || a.moved || a.removed) parts.push(`+${a.created} ~${a.updated + a.moved} −${a.removed}`);
  if (r.joined) parts.push(`${r.joined} matched`);
  return parts.join(' · ') || 'up to date';
}

// ---------------------------------------------------------------- record edits

/** Applies `fn` to a few records with fresh stamps, under the lock. */
export function mutate(ids: string[], fn: (rec: Rec, clock: Clock) => boolean): Promise<number> {
  return locked(async () => {
    const meta = await kvGet<Omit<DeviceData, 'state'> | null>('device', null);
    if (!meta) return 0;
    const clock = new Clock(meta.deviceId, meta.clock);
    const recs = (await db.records.bulkGet(ids)).filter(Boolean) as Rec[];
    const changed = recs.filter((r) => fn(r, clock));
    if (changed.length) {
      await db.transaction('rw', db.records, db.kv, async () => {
        await db.records.bulkPut(changed);
        await db.kv.put({ key: 'device', value: { ...meta, clock: clock.last } });
      });
      scheduleRemoteSync();
    }
    return changed.length;
  });
}

async function nativeIdOf(id: string): Promise<string> {
  const meta = await kvGet<Omit<DeviceData, 'state'> | null>('device', null);
  const nid = meta?.map[id];
  if (!nid) throw new Error('This item is not in this browser yet; sync first.');
  return nid;
}

export async function editNative(id: string, changes: { title?: string; url?: string }) {
  const clean: { title?: string; url?: string } = {};
  if (changes.title !== undefined) clean.title = changes.title;
  if (changes.url !== undefined) clean.url = changes.url;
  await browser.bookmarks.update(await nativeIdOf(id), clean);
  await sync({ localOnly: true });
}

export async function moveNative(ids: string[], parent: string, index?: number) {
  const pid = await nativeIdOf(parent);
  let i = index;
  for (const id of ids) {
    await browser.bookmarks.move(await nativeIdOf(id), i === undefined ? { parentId: pid } : { parentId: pid, index: i++ });
  }
  await sync({ localOnly: true });
}

/** Addresses Xezina is bookmarking itself, so its own creations are not mistaken for the browser's star. */
export const ownCreates = new Set<string>();

export async function createNative(parent: string, title: string, url?: string, index?: number): Promise<string | null> {
  if (url) {
    ownCreates.add(url);
    setTimeout(() => ownCreates.delete(url), 5000);
  }
  const node = await browser.bookmarks.create({ parentId: await nativeIdOf(parent), title, url, index });
  await sync({ localOnly: true });
  const meta = await kvGet<Omit<DeviceData, 'state'> | null>('device', null);
  const found = Object.entries(meta?.map ?? {}).find(([, nid]) => nid === node.id);
  return found?.[0] ?? null;
}

export async function removeNative(ids: string[]) {
  for (const id of ids) {
    try {
      await browser.bookmarks.removeTree(await nativeIdOf(id));
    } catch {
      // already gone
    }
  }
  await sync({ localOnly: true });
}

export async function setMeta(ids: string[], patch: Partial<Pick<FieldValues, 'notes' | 'tags' | 'fav' | 'label'>>) {
  const clean = { ...patch };
  if (clean.tags) clean.tags = uniqueTags(clean.tags);
  return mutate(ids, (rec, clock) => setFields(rec, clean, clock));
}

export async function editTags(ids: string[], add: string[] = [], remove: string[] = []) {
  const rm = new Set(uniqueTags(remove));
  return mutate(ids, (rec, clock) => {
    const next = uniqueTags([...(rec.v.tags ?? []), ...add]).filter((t) => !rm.has(t));
    return setField(rec, 'tags', next, clock);
  });
}

// ---------------------------------------------------------------- scheduling

let remoteTimer: ReturnType<typeof setTimeout> | undefined;
let scanTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced sync after local edits. */
export function scheduleRemoteSync(delay = 15_000) {
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(async () => {
    const s = await getSettings();
    if (s.remote && s.autoSync) void sync().catch(() => undefined);
  }, delay);
}

export function onBookmarkEvent() {
  if (applying) return;
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    void sync({ localOnly: true })
      .then(() => {
        scheduleRemoteSync();
        scheduleEnrich();
      })
      .catch(() => undefined);
  }, 700);
}

export async function reschedule() {
  const s = await getSettings();
  await browser.alarms.clear('xezina-sync');
  if (s.remote && s.autoSync) {
    await browser.alarms.create('xezina-sync', { periodInMinutes: Math.max(1, s.intervalMin), delayInMinutes: 0.2 });
  }
  await browser.alarms.create('xezina-enrich', { periodInMinutes: 30 });
}

// ---------------------------------------------------------------- previews & link check

let enrichAbort = false;
let enrichRunning = false;
let enrichTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleEnrich(delay = 5_000) {
  clearTimeout(enrichTimer);
  enrichTimer = setTimeout(() => void enrich().catch(() => undefined), delay);
}

export async function hasAllUrls(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: ['<all_urls>'] });
  } catch {
    return false;
  }
}

/** Fetches descriptions + preview images and checks links. Resumable. */
export async function enrich(ids?: string[], force = false) {
  if (enrichRunning) return;
  const s = await getSettings();
  if (!s.previews.fetchMeta && !ids) return;
  if (!(await hasAllUrls())) return;
  enrichRunning = true;
  enrichAbort = false;
  try {
    const all = await db.records.toArray();
    const alive = buildTree(Object.fromEntries(all.map((r) => [r.id, r])) as State).byId;
    const wanted = new Set(ids ?? []);
    const queue = all.filter(
      (r) =>
        alive.has(r.id) &&
        r.v.kind === 'bookmark' &&
        /^https?:/i.test(r.v.url ?? '') &&
        !isProtectedPage(r.v.url ?? '') &&
        (ids ? wanted.has(r.id) : force || !r.v.checkedAt),
    );
    const status: EnrichStatus = { running: true, done: 0, total: queue.length };
    await kvSet('enrich', status);
    const worker = async () => {
      while (queue.length && !enrichAbort) {
        const rec = queue.shift()!;
        await enrichOne(rec, s);
        status.done++;
        if (status.done % 3 === 0 || !queue.length) await kvSet('enrich', { ...status });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  } finally {
    enrichRunning = false;
    const st = await kvGet<EnrichStatus>('enrich', { running: false, done: 0, total: 0 });
    await kvSet('enrich', { ...st, running: false });
  }
}

export function stopEnrich() {
  enrichAbort = true;
}

async function storeBlob(blob: Blob): Promise<string> {
  const hash = await hashBlob(blob);
  if (!(await db.blobs.get(hash))) await db.blobs.put({ hash, blob, remote: 0, at: Date.now() });
  return hash;
}

async function enrichOne(rec: Rec, s: Settings) {
  const info = await fetchPage(rec.v.url as string);
  let img = '';
  if (info.image && !rec.v.img) {
    const raw = await downloadImage(info.image);
    if (raw) {
      try {
        img = await storeBlob(await makePreview(raw));
      } catch {
        img = '';
      }
    }
  }
  await mutate([rec.id], (r, clock) => {
    const patch: Partial<FieldValues> = { status: info.status, checkedAt: Date.now() };
    if (info.desc && !r.v.desc) patch.desc = info.desc;
    if (img && !r.v.img) {
      patch.img = img;
      patch.imgSrc = 'og';
    }
    // The browser title stays exactly as the user set it (even empty); the page title is kept aside.
    if (info.title && info.title !== r.v.siteTitle) patch.siteTitle = info.title;
    const changed = setFields(r, patch, clock);
    return changed;
  });
  if (img && s.previews.syncImages) scheduleRemoteSync(30_000);
}

/** Screenshot of a visible tab as the bookmark's preview. */
export async function capture(windowId: number, id: string) {
  const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 85 });
  const hash = await storeBlob(await makePreview(dataUrlToBlob(dataUrl), true));
  await mutate([id], (r, clock) => setFields(r, { img: hash, imgSrc: 'shot' }, clock));
  return hash;
}

export async function setImage(id: string, dataUrl: string) {
  const hash = await storeBlob(await makePreview(dataUrlToBlob(dataUrl)));
  await mutate([id], (r, clock) => setFields(r, { img: hash, imgSrc: 'user' }, clock));
  return hash;
}

const recentCaptures = new Map<string, number>();

/** Called when a tab finished loading: screenshot it if it is a bookmark without a screenshot. */
export async function maybeAutoCapture(tab: { id?: number; windowId?: number; url?: string; active?: boolean }) {
  if (!tab.url || !tab.active || tab.windowId === undefined || !/^https?:/.test(tab.url) || isProtectedPage(tab.url)) return;
  const s = await getSettings();
  if (!s.previews.autoCapture || !(await hasAllUrls())) return;
  const key = normalizeUrl(tab.url);
  if (Date.now() - (recentCaptures.get(key) ?? 0) < 60_000) return;
  const all = await db.records.toArray();
  const rec = all.find((r) => r.v.kind === 'bookmark' && !r.v.del && r.v.url && normalizeUrl(r.v.url) === key);
  if (!rec || rec.v.imgSrc === 'shot' || rec.v.imgSrc === 'user') return;
  recentCaptures.set(key, Date.now());
  await new Promise((r) => setTimeout(r, 1500));
  const [current] = await browser.tabs.query({ active: true, windowId: tab.windowId });
  if (!current || current.id !== tab.id) return;
  try {
    await capture(tab.windowId, rec.id);
  } catch {
    // window not focused, a protected page, etc.
  }
}

// ---------------------------------------------------------------- blobs

async function uploadBlobs(remote: RemoteStorage, key: CryptoKey | null) {
  // Every GitHub upload is a commit, so trickle images there.
  const batch = remote.id.startsWith('github:') ? 20 : 150;
  const pending = await db.blobs.where('remote').equals(0).limit(batch).toArray();
  for (const b of pending) {
    const bytes = new Uint8Array(await b.blob.arrayBuffer());
    await remote.put(`blobs/${b.hash}`, await encodeBytes(bytes, key));
    await db.blobs.update(b.hash, { remote: 1 });
  }
}

/** Downloads a preview another device uploaded. */
export async function fetchBlob(hash: string): Promise<boolean> {
  if (await db.blobs.get(hash)) return true;
  const s = await getSettings();
  const remote = await remoteFor(s);
  if (!remote) return false;
  const bytes = await remote.get(`blobs/${hash}`);
  if (!bytes) return false;
  const raw = await decodeBytes(bytes, await keyFor(s));
  const blob = new Blob([raw as BlobPart], { type: raw[0] === 0xff ? 'image/jpeg' : 'image/webp' });
  await db.blobs.put({ hash, blob, remote: 1, at: Date.now() });
  return true;
}

// ---------------------------------------------------------------- settings actions

export async function testRemote(cfg: RemoteConfig): Promise<{ files: number; encrypted: boolean }> {
  const s = await getSettings();
  if (cfg.type === 'github') {
    // Checks the token; the repository is created on save if it does not exist.
    await githubUser(cfg.token);
    return { files: 0, encrypted: false };
  }
  const remote = await remoteFor({ ...s, remote: cfg });
  if (!remote) throw new Error('No storage');
  const meta = await readMeta(remote);
  const files = await remote.list(DEVICES_DIR);
  return { files: files.length, encrypted: !!meta?.encryption };
}

export async function setRemote(cfg: RemoteConfig | null) {
  if (cfg?.type === 'github') {
    if (!cfg.owner) cfg.owner = await githubUser(cfg.token);
    const { branch } = await ensureRepo(cfg.token, cfg.owner, cfg.repo || 'xezina-data');
    if (!cfg.branch) cfg.branch = branch;
  }
  await saveSettings({ remote: cfg, ...(cfg && isOAuth(cfg.type) ? {} : { tokens: null }) });
  await setStatus({ ...DEFAULT_STATUS });
  await reschedule();
  if (cfg) void sync().catch(() => undefined);
}

export async function connectOAuth(provider: 'dropbox' | 'gdrive' | 'onedrive') {
  const s = await getSettings();
  const clientId = s.clientIds[provider] || BUILT_IN_CLIENT_IDS[provider];
  const tokens = await signIn(provider, clientId, true);
  await saveSettings({ tokens });
  await setRemote({ type: provider, connection: newId() });
}

export async function githubStart(): Promise<DeviceCode> {
  const s = await getSettings();
  const clientId = s.clientIds.github || BUILT_IN_CLIENT_IDS.github;
  if (!clientId) throw new Error('No GitHub client id configured; use a token instead.');
  return githubDeviceStart(clientId);
}

export async function githubFinish(code: DeviceCode) {
  const s = await getSettings();
  const clientId = s.clientIds.github || BUILT_IN_CLIENT_IDS.github;
  const token = await githubDevicePoll(clientId, code);
  const owner = await githubUser(token);
  const { branch } = await ensureRepo(token, owner, 'xezina-data');
  await setRemote({ type: 'github', token, owner, repo: 'xezina-data', branch, dir: 'xezina' });
  return { owner };
}

/** Turns end-to-end encryption on (with a passphrase) or off (null). */
export async function setEncryption(passphrase: string | null) {
  const s = await getSettings();
  const remote = await remoteFor(s);
  if (!remote) throw new Error('Choose a storage first.');
  const meta = await readMeta(remote);
  if (passphrase === null) {
    await writeMeta(remote, { app: 'xezina', format: 1, encryption: null });
    await saveSettings({ encryption: { enabled: false, key: '' } });
    await sync({ mode: 'push' });
    return;
  }
  if (meta?.encryption) {
    // Joining an encrypted storage: the passphrase must match.
    const key = await deriveKey(passphrase, fromBase64(meta.encryption.salt), meta.encryption.iterations);
    if (!(await verifyCheck(meta.encryption.check, key))) throw new Error('Wrong passphrase');
    await saveSettings({ encryption: { enabled: true, key: await exportKey(key) } });
    await setStatus({ state: 'idle', lastError: '' });
    await sync();
    return;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  await writeMeta(remote, {
    app: 'xezina',
    format: 1,
    encryption: { salt: toBase64(salt), iterations: PBKDF2_ITERATIONS, check: await makeCheck(key) },
  });
  await saveSettings({ encryption: { enabled: true, key: await exportKey(key) } });
  await db.blobs.toCollection().modify({ remote: 0 });
  await sync({ mode: 'push' });
}

export async function forgetDevice(deviceId: string) {
  const s = await getSettings();
  const remote = await remoteFor(s);
  if (!remote) return;
  await remote.delete(`${DEVICES_DIR}/${deviceId}.xz`);
  const st = await getStatus();
  await setStatus({ devices: st.devices.filter((d) => d.id !== deviceId) });
}

export async function createBackup() {
  const data = await loadDevice();
  await backup(data.state, 'manual');
}

/** Restores a backup: everything in it comes back, everything else is removed. */
export async function restoreBackup(id: number) {
  const row = await db.backups.get(id);
  if (!row) throw new Error('Backup not found');
  await locked(async () => {
    const data = await loadDevice();
    await backup(data.state, 'before-restore');
    const before = cloneState(data.state);
    const clock = new Clock(data.deviceId, data.clock);
    for (const r of Object.values(row.state)) for (const s of Object.values(r.s)) clock.observe(s);
    for (const r of Object.values(data.state)) for (const s of Object.values(r.s)) clock.observe(s);
    const wanted = buildTree(row.state).byId;
    for (const [rid, node] of wanted) {
      if (isRoot(rid)) continue;
      const rec = data.state[rid] ?? (data.state[rid] = newRecord(rid));
      for (const [f, v] of Object.entries(node.rec.v)) {
        (rec.v as Record<string, unknown>)[f] = Array.isArray(v) ? v.slice() : v;
        (rec.s as Record<string, string>)[f] = clock.now();
      }
      rec.v.del = false;
      rec.s.del = clock.now();
    }
    for (const rec of Object.values(data.state)) {
      if (!isRoot(rec.id) && !wanted.has(rec.id) && !rec.v.del) setField(rec, 'del', true, clock);
    }
    data.clock = clock.last;
    await saveDevice(data, before);
  });
  await sync({ localOnly: true, allowMassDelete: true });
  scheduleRemoteSync(1_000);
}


// ---------------------------------------------------------------- the browser's star

/** Record id for a native bookmark id (after a local scan). */
async function recordIdOf(nativeId: string): Promise<string | null> {
  const meta = await kvGet<Omit<DeviceData, 'state'> | null>('device', null);
  return Object.entries(meta?.map ?? {}).find(([, nid]) => nid === nativeId)?.[0] ?? null;
}

/**
 * Someone bookmarked the page they are looking at with the browser's own star
 * (or Ctrl+D): capture it, fetch its description, and offer to add notes.
 */
export let importing = false;
export function setImporting(v: boolean) {
  importing = v;
}
const recentCreates: number[] = [];

export async function onBrowserBookmarked(nativeId: string, url: string) {
  if (applying || importing || ownCreates.has(url)) return;
  const now = Date.now();
  recentCreates.push(now);
  while (recentCreates.length && now - recentCreates[0] > 2000) recentCreates.shift();
  const s = await getSettings();
  if (s.afterStar === 'none' && !s.previews.autoCapture) return;
  const access = await hasAllUrls();
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (access) {
    // With page access we can be sure it was the page in front of the user.
    if (!tab?.url || normalizeUrl(tab.url) !== normalizeUrl(url)) return;
  } else {
    // Without it, only react to a single bookmark (not a paste or drag of many).
    await new Promise((r) => setTimeout(r, 700));
    if (recentCreates.some((t) => t !== now && Math.abs(t - now) < 1000)) return;
  }
  await new Promise((r) => setTimeout(r, 400));
  await sync({ localOnly: true }).catch(() => undefined);
  const id = await recordIdOf(nativeId);
  if (!id) return;
  // The popup shows this bookmark even when it cannot read the tab's address.
  await kvSet('lastStar', { id, at: Date.now() });
  if (access && s.previews.autoCapture && tab?.windowId !== undefined && !isProtectedPage(url)) {
    await capture(tab.windowId, id).catch(() => undefined);
  }
  if (access) void enrich([id]).catch(() => undefined);
  scheduleRemoteSync();

  if (s.afterStar === 'popup') {
    try {
      // Give the browser's own bookmark bubble a moment to close.
      await new Promise((r) => setTimeout(r, 500));
      await (browser.action ?? (browser as unknown as { browserAction: typeof browser.action }).browserAction).openPopup();
      return;
    } catch {
      // Not allowed here (older browser, no focused window…): fall back to a notification.
    }
  }
  if (s.afterStar !== 'none') await notifySaved(id);
}

async function notifySaved(id: string) {
  const { makeI18n, resolveLang } = await import('../ui/i18n');
  const s = await getSettings();
  const { t } = makeI18n(resolveLang(s.lang));
  try {
    await browser.notifications.create(`xz-saved:${id}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: t('starSavedTitle'),
      message: t('starSavedBody'),
    });
  } catch {
    // notifications blocked
  }
}

export function onNotificationClicked(notificationId: string) {
  if (!notificationId.startsWith('xz-saved:')) return;
  const id = notificationId.slice('xz-saved:'.length);
  void browser.tabs.create({ url: browser.runtime.getURL('/manager.html') + `#/library/all?edit=${encodeURIComponent(id)}` });
  void browser.notifications.clear(notificationId);
}
