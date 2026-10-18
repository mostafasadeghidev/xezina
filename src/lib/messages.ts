import { browser } from 'wxt/browser';
import type { FieldValues } from '../core/types';
import type { RemoteConfig } from '../storage/registry';
import type { SyncMode, SyncReport } from '../sync/engine';
import type { DeviceCode } from '../storage/github';

/** Everything the popup and the manager can ask the background to do. */
export type Message =
  | { type: 'sync'; mode?: SyncMode; allowMassDelete?: boolean }
  | { type: 'scan' }
  | { type: 'meta'; ids: string[]; patch: Partial<Pick<FieldValues, 'notes' | 'tags' | 'fav' | 'label'>> }
  | { type: 'tags'; ids: string[]; add?: string[]; remove?: string[] }
  | { type: 'edit'; id: string; title?: string; url?: string }
  | { type: 'move'; ids: string[]; parent: string; index?: number }
  | { type: 'create'; parent: string; title: string; url?: string; index?: number }
  | { type: 'remove'; ids: string[] }
  | { type: 'enrich'; ids?: string[]; force?: boolean }
  | { type: 'enrich:stop' }
  | { type: 'capture'; tabId: number; windowId: number; id: string }
  | { type: 'blob:fetch'; hash: string }
  | { type: 'image:set'; id: string; dataUrl: string }
  | { type: 'remote:test'; config: RemoteConfig }
  | { type: 'remote:set'; config: RemoteConfig | null }
  | { type: 'oauth:connect'; provider: 'dropbox' | 'gdrive' | 'onedrive' }
  | { type: 'github:device-start' }
  | { type: 'github:device-finish'; code: DeviceCode }
  | { type: 'encryption:set'; passphrase: string | null }
  | { type: 'backup:create' }
  | { type: 'backup:restore'; id: number }
  | { type: 'remote:devices' }
  | { type: 'remote:forget-device'; deviceId: string }
  | { type: 'reschedule' };

export type Reply<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export async function send<T = unknown>(msg: Message): Promise<T> {
  const reply = (await browser.runtime.sendMessage(msg)) as Reply<T> | undefined;
  if (!reply) throw new Error('No response from the background');
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

export type { SyncReport };
