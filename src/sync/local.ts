import type { Stamp, State } from '../core/types';

/** What this device last saw of a mirrored node, used to detect user edits. */
export interface Shadow {
  parent: string;
  title: string;
  url: string;
}

/** Everything one device keeps about its own browser and sync progress. */
export interface DeviceData {
  deviceId: string;
  /** Merged records (the bookmarks of every device). */
  state: State;
  /** Record id → native bookmark id on this browser. */
  map: Record<string, string>;
  shadow: Record<string, Shadow>;
  /** Records this browser cannot hold (e.g. separators in Chrome), with the stamp at which they failed. */
  skipped: Record<string, Stamp>;
  clock: Stamp;
  /** Remote identities this device has already joined (deduplicated against). */
  joined: string[];
  /** Remote file name → etag we already merged. */
  seen: Record<string, string>;
  /** Hash of the last state file this device uploaded. */
  pushedHash: string;
}

export function emptyDeviceData(deviceId: string): DeviceData {
  return {
    deviceId,
    state: {},
    map: {},
    shadow: {},
    skipped: {},
    clock: '',
    joined: [],
    seen: {},
    pushedHash: '',
  };
}

export function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += b.toString(36).padStart(2, '0');
  return s.slice(0, 14);
}
