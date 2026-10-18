import { Clock } from '../core/clock';
import { cloneRecord, cloneState, mergeState } from '../core/crdt';
import { buildTree } from '../core/tree';
import { isRoot, type FieldName, type State } from '../core/types';
import type { RemoteStorage } from '../storage/types';
import { decodeJson, encodeJson, fromBase64, NeedsKeyError, sha256Hex, toBase64 } from './codec';
import { join } from './join';
import type { DeviceData } from './local';
import { materialize, type ApplyStats } from './materialize';
import type { NativeApi } from './native';
import { scan } from './scan';

export const DEVICES_DIR = 'devices';
export const META_FILE = 'meta.json';
export const FORMAT = 1;

export interface DeviceInfo {
  id: string;
  name: string;
  browser: string;
  updatedAt: number;
}

export interface DeviceFile {
  format: number;
  device: DeviceInfo;
  state: State;
}

export interface RemoteMeta {
  app: 'xezina';
  format: number;
  encryption: null | { salt: string; iterations: number; check: string };
}

export type SyncMode = 'normal' | 'push' | 'pull';

export interface SyncOptions {
  remote?: RemoteStorage | null;
  key?: CryptoKey | null;
  mode?: SyncMode;
  allowMassDelete?: boolean;
}

export interface SyncReport {
  localChanges: number;
  remoteChanges: number;
  pulledFrom: string[];
  joined: number;
  applied: ApplyStats;
  pushed: boolean;
  devices: DeviceInfo[];
}

export interface EngineDeps {
  native: NativeApi;
  load(): Promise<DeviceData>;
  save(data: DeviceData): Promise<void>;
  /** Snapshot (of the library as it was before this round) taken right before sync changes the browser. */
  backup?(state: State, reason: string): Promise<void>;
  device(): Promise<{ name: string; browser: string }>;
}

export function deviceFileName(deviceId: string) {
  return `${deviceId}.xz`;
}

/**
 * One sync round:
 *  1. read the browser and record local edits,
 *  2. read other devices' files and merge them (deduplicating on first contact),
 *  3. apply the merged result to the browser,
 *  4. upload this device's merged copy.
 * Without a remote it only does step 1 (keeps the library up to date).
 */
export async function runSync(deps: EngineDeps, opts: SyncOptions = {}): Promise<SyncReport> {
  const { remote = null, key = null, mode = 'normal' } = opts;
  const data = await deps.load();
  const clock = new Clock(data.deviceId, data.clock);
  const report: SyncReport = {
    localChanges: 0,
    remoteChanges: 0,
    pulledFrom: [],
    joined: 0,
    applied: { created: 0, updated: 0, moved: 0, removed: 0, skipped: 0 },
    pushed: false,
    devices: [],
  };

  report.localChanges = scan(await deps.native.getTree(), data, clock).changed.size;
  const before = deps.backup ? cloneState(data.state) : null;

  if (remote) {
    const ownFile = deviceFileName(data.deviceId);
    const firstContact = !data.joined.includes(remote.id);
    const files = await remote.list(DEVICES_DIR);
    const incoming: State = {};
    for (const f of files) {
      if (!f.name.endsWith('.xz') || (f.name === ownFile && mode !== 'pull')) continue;
      const fresh = data.seen[f.name] !== f.etag;
      if (!fresh && !firstContact && mode === 'normal') continue;
      const bytes = await remote.get(`${DEVICES_DIR}/${f.name}`);
      if (!bytes) continue;
      const file = await decodeJson<DeviceFile>(bytes, key);
      if (file.format > FORMAT) throw new Error('Remote data was written by a newer Xezina; please update.');
      mergeState(incoming, file.state);
      data.seen[f.name] = f.etag;
      if (fresh) report.pulledFrom.push(file.device.name);
      report.devices.push(file.device);
    }
    for (const id of Object.keys(incoming)) {
      for (const s of Object.values(incoming[id].s)) clock.observe(s);
    }

    if (mode === 'pull') {
      if (!Object.keys(incoming).length) throw new Error('The remote storage has no bookmarks yet.');
      // The cloud wins: forget local edits that are not in it.
      data.state = cloneState(incoming);
      report.remoteChanges = Object.keys(incoming).length;
    } else if (mode === 'push') {
      // This browser wins: newer stamps on everything we hold, tombstones for the rest.
      const alive = buildTree(data.state).byId;
      for (const id of Object.keys(incoming)) {
        if (!alive.has(id) && !isRoot(id) && !data.skipped[id]) {
          const rec = data.state[id] ?? (data.state[id] = cloneRecord(incoming[id]));
          rec.v.del = true;
          rec.s.del = clock.now();
        }
      }
      for (const id of alive.keys()) {
        const rec = data.state[id];
        if (!rec) continue;
        for (const f of Object.keys(rec.s) as FieldName[]) rec.s[f] = clock.now();
      }
    } else {
      if (firstContact) report.joined = join(data, incoming, clock);
      report.remoteChanges = mergeState(data.state, incoming, clock).length;
    }
    if (firstContact) data.joined.push(remote.id);
  }

  try {
    report.applied = await materialize(deps.native, data, {
      allowMassDelete: opts.allowMassDelete || mode === 'pull',
      beforeChange: before ? () => deps.backup!(before, mode === 'normal' ? 'sync' : mode) : undefined,
    });
  } catch (e) {
    // Keep what was learned (local edits, merged data); applying is retried next time.
    data.clock = clock.last;
    await deps.save(data);
    throw e;
  }

  if (remote) {
    const hash = await sha256Hex(JSON.stringify(data.state));
    if (hash !== data.pushedHash || mode !== 'normal') {
      const dev = await deps.device();
      const file: DeviceFile = {
        format: FORMAT,
        device: { id: data.deviceId, ...dev, updatedAt: Date.now() },
        state: data.state,
      };
      await remote.put(`${DEVICES_DIR}/${deviceFileName(data.deviceId)}`, await encodeJson(file, key));
      data.pushedHash = hash;
      report.pushed = true;
    }
  }

  data.clock = clock.last;
  await deps.save(data);
  return report;
}

/** Reads (or creates) the remote's meta file. */
export async function readMeta(remote: RemoteStorage): Promise<RemoteMeta | null> {
  const bytes = await remote.get(META_FILE);
  if (!bytes) return null;
  const meta = JSON.parse(new TextDecoder().decode(bytes)) as RemoteMeta;
  if (meta.app !== 'xezina') throw new Error('This folder belongs to another app');
  return meta;
}

export async function writeMeta(remote: RemoteStorage, meta: RemoteMeta) {
  await remote.put(META_FILE, new TextEncoder().encode(JSON.stringify(meta, null, 2)));
}

/** Encrypted marker used to verify a passphrase before touching data. */
export async function makeCheck(key: CryptoKey): Promise<string> {
  return toBase64(await encodeJson({ app: 'xezina' }, key));
}

export async function verifyCheck(check: string, key: CryptoKey): Promise<boolean> {
  try {
    const v = await decodeJson<{ app: string }>(fromBase64(check), key);
    return v.app === 'xezina';
  } catch {
    return false;
  }
}

export { NeedsKeyError };
