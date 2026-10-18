import { afterEach, describe, expect, it, vi } from 'vitest';
import { S3Storage } from '../src/storage/s3';
import { GitHubStorage } from '../src/storage/github';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const merged = input instanceof Request ? { method: input.method, headers: input.headers, ...init } : init;
    calls.push({ url, init: merged });
    return handler(url, merged);
  });
  return calls;
}

describe('S3', () => {
  const cfg = {
    type: 's3' as const,
    endpoint: 'https://acc.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'bk',
    accessKeyId: 'AK',
    secretAccessKey: 'SK',
    prefix: 'xezina',
    pathStyle: true,
  };

  it('lists files of one folder with paging, and signs requests', async () => {
    let page = 0;
    const calls = stubFetch((url) => {
      page++;
      const body =
        page === 1
          ? `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>t&amp;2</NextContinuationToken>
             <Contents><Key>xezina/devices/a.xz</Key><ETag>&quot;e1&quot;</ETag><Size>10</Size></Contents></ListBucketResult>`
          : `<ListBucketResult><IsTruncated>false</IsTruncated>
             <Contents><Key>xezina/devices/b.xz</Key><ETag>"e2"</ETag><Size>20</Size></Contents></ListBucketResult>`;
      return new Response(body, { status: 200 });
    });
    const s = new S3Storage(cfg);
    const files = await s.list('devices');
    expect(files).toEqual([
      { name: 'a.xz', etag: 'e1', size: 10 },
      { name: 'b.xz', etag: 'e2', size: 20 },
    ]);
    expect(calls[0].url).toContain('https://acc.r2.cloudflarestorage.com/bk/?');
    expect(calls[0].url).toContain('prefix=xezina%2Fdevices%2F');
    expect(calls[1].url).toContain('continuation-token=t%262');
    const auth = new Headers(calls[0].init.headers).get('authorization') ?? '';
    expect(auth).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\//);
  });

  it('returns null for a missing object', async () => {
    stubFetch(() => new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 }));
    expect(await new S3Storage(cfg).get('meta.json')).toBeNull();
  });

  it('uses virtual-hosted URLs when path style is off', async () => {
    const calls = stubFetch(() => new Response(new Uint8Array([1]), { status: 200 }));
    await new S3Storage({ ...cfg, pathStyle: false }).get('meta.json');
    expect(calls[0].url).toBe('https://bk.acc.r2.cloudflarestorage.com/xezina/meta.json');
  });
});

describe('GitHub', () => {
  const cfg = { type: 'github' as const, token: 'tok', owner: 'me', repo: 'data', branch: 'main', dir: 'xezina' };

  it('lists, then updates a file with its sha', async () => {
    const calls = stubFetch((url, init) => {
      if ((init.method ?? 'GET') === 'GET')
        return Response.json([
          { type: 'file', name: 'a.xz', sha: 's1', size: 3 },
          { type: 'dir', name: 'x', sha: 's2', size: 0 },
        ]);
      return Response.json({ content: { sha: 's3' } }, { status: 200 });
    });
    const s = new GitHubStorage(cfg);
    expect(await s.list('devices')).toEqual([{ name: 'a.xz', etag: 's1', size: 3 }]);
    await s.put('devices/a.xz', new Uint8Array([104, 105]));
    const put = calls[1];
    expect(put.url).toBe('https://api.github.com/repos/me/data/contents/xezina/devices/a.xz');
    const body = JSON.parse(put.init.body as string);
    expect(body).toMatchObject({ sha: 's1', content: 'aGk=', branch: 'main' });
  });

  it('treats a missing folder as empty', async () => {
    stubFetch(() => new Response('{"message":"Not Found"}', { status: 404 }));
    expect(await new GitHubStorage(cfg).list('devices')).toEqual([]);
  });
});
