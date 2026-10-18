import Dexie, { type Table } from 'dexie';
import type { Rec, State } from '../core/types';
import type { DeviceInfo, SyncReport } from '../sync/engine';
import { emptyDeviceData, newId, type DeviceData } from '../sync/local';

export interface BlobRow {
  hash: string;
  blob: Blob;
  /** 1 when uploaded to the remote storage. */
  remote: 0 | 1;
  at: number;
}

export interface BackupRow {
  id?: number;
  at: number;
  reason: string;
  count: number;
  state: State;
}

export interface LogRow {
  id?: number;
  at: number;
  ok: boolean;
  mode: string;
  message: string;
  report?: SyncReport;
  ms: number;
}

export interface KvRow {
  key: string;
  value: unknown;
}

export class XezinaDB extends Dexie {
  records!: Table<Rec, string>;
  kv!: Table<KvRow, string>;
  blobs!: Table<BlobRow, string>;
  backups!: Table<BackupRow, number>;
  logs!: Table<LogRow, number>;

  constructor() {
    super('xezina');
    this.version(1).stores({
      records: 'id',
      kv: 'key',
      blobs: 'hash, remote',
      backups: '++id, at',
      logs: '++id, at',
    });
  }
}

export const db = new XezinaDB();

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

export async function kvSet(key: string, value: unknown) {
  await db.kv.put({ key, value });
}

type DeviceMeta = Omit<DeviceData, 'state'>;

/** Loads this device's sync data; creates a device id on first run. */
export async function loadDevice(): Promise<DeviceData> {
  const meta = await kvGet<DeviceMeta | null>('device', null);
  const records = await db.records.toArray();
  const state: State = {};
  for (const r of records) state[r.id] = r;
  if (!meta) {
    const fresh = emptyDeviceData(newId());
    fresh.state = state;
    return fresh;
  }
  return { ...emptyDeviceData(meta.deviceId), ...meta, state };
}

/** Saves records that changed since `before` plus the device metadata. */
export async function saveDevice(data: DeviceData, before?: State) {
  const { state, ...meta } = data;
  const changed: Rec[] = [];
  for (const id of Object.keys(state)) {
    const old = before?.[id];
    if (!old || JSON.stringify(old) !== JSON.stringify(state[id])) changed.push(state[id]);
  }
  const removed = before ? Object.keys(before).filter((id) => !state[id]) : [];
  await db.transaction('rw', db.records, db.kv, async () => {
    if (changed.length) await db.records.bulkPut(changed);
    if (removed.length) await db.records.bulkDelete(removed);
    await db.kv.put({ key: 'device', value: meta });
  });
}

export interface SyncStatus {
  state: 'idle' | 'running' | 'error' | 'confirm' | 'needs-key';
  lastSync: number;
  lastError: string;
  /** For 'confirm': how many bookmarks the sync wants to delete. */
  pendingDeletes?: { count: number; total: number };
  devices: DeviceInfo[];
}

export const DEFAULT_STATUS: SyncStatus = { state: 'idle', lastSync: 0, lastError: '', devices: [] };

export interface EnrichStatus {
  running: boolean;
  done: number;
  total: number;
}
