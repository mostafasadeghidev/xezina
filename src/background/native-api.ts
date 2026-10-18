import { browser } from 'wxt/browser';
import type { CreateDetails, NativeApi, NativeNode } from '../sync/native';

/** The browser's bookmarks API behind the NativeApi interface. */
export const nativeApi: NativeApi = {
  async getTree() {
    return (await browser.bookmarks.getTree()) as unknown as NativeNode[];
  },
  async create(d: CreateDetails) {
    const details: Record<string, unknown> = { parentId: d.parentId };
    if (d.index !== undefined) details.index = d.index;
    if (d.type === 'separator') {
      details.type = 'separator';
    } else {
      details.title = d.title ?? '';
      if (d.url !== undefined) details.url = d.url;
    }
    return (await browser.bookmarks.create(details)) as unknown as NativeNode;
  },
  async update(id, changes) {
    return (await browser.bookmarks.update(id, changes)) as unknown as NativeNode;
  },
  async move(id, dest) {
    return (await browser.bookmarks.move(id, dest)) as unknown as NativeNode;
  },
  async removeTree(id) {
    await browser.bookmarks.removeTree(id);
  },
  async remove(id) {
    await browser.bookmarks.remove(id);
  },
};
