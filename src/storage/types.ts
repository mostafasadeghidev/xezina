/**
 * A remote storage is nothing more than a place for files. Every provider —
 * WebDAV, S3, GitHub, Dropbox, Google Drive, OneDrive — implements these
 * five calls; all sync logic lives on the client.
 */
export interface RemoteFile {
  /** File name inside the listed directory (no slashes). */
  name: string;
  /** Changes whenever the content changes. */
  etag: string;
  size?: number;
}

export interface RemoteStorage {
  /** Stable identity of the location (used to remember "already joined"). */
  readonly id: string;
  /** Files directly inside `dir` ('' = root). Missing dir → []. */
  list(dir: string): Promise<RemoteFile[]>;
  /** File content, or null when it does not exist. */
  get(path: string): Promise<Uint8Array | null>;
  put(path: string, data: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
}

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

/** In-memory storage, for tests and as a reference implementation. */
export class MemoryStorage implements RemoteStorage {
  files = new Map<string, { data: Uint8Array; etag: string }>();
  private n = 0;
  constructor(readonly id = 'memory') {}

  async list(dir: string): Promise<RemoteFile[]> {
    const prefix = dir ? dir.replace(/\/$/, '') + '/' : '';
    const out: RemoteFile[] = [];
    for (const [path, f] of this.files) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.includes('/')) continue;
      out.push({ name: rest, etag: f.etag, size: f.data.length });
    }
    return out;
  }
  async get(path: string) {
    return this.files.get(path)?.data.slice() ?? null;
  }
  async put(path: string, data: Uint8Array) {
    this.files.set(path, { data: data.slice(), etag: String(++this.n) });
  }
  async delete(path: string) {
    this.files.delete(path);
  }
}
