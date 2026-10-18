import { describe, expect, it } from 'vitest';
import { findFix, parentUrls, type PageInfo } from '../src/enrich/metadata';

const page = (status: number, finalUrl: string): PageInfo => ({ status, finalUrl, title: '', desc: '', image: '' });

/** A fake site: the listed addresses answer 200, everything else 404. */
function site(alive: string[]) {
  return async (url: string) => page(alive.includes(url) ? 200 : 404, url);
}

describe('link fixer', () => {
  it('lists parent addresses nearest first', () => {
    expect(parentUrls('https://shop.com/blog/2021/post-5?ref=x')).toEqual([
      'https://shop.com/blog/2021/post-5',
      'https://shop.com/blog/2021/',
      'https://shop.com/blog/',
      'https://shop.com/',
    ]);
  });

  it('suggests the nearest working parent of a missing page', async () => {
    const fix = await findFix('https://shop.com/blog/2021/post-5', page(404, ''), site(['https://shop.com/blog/', 'https://shop.com/']));
    expect(fix).toEqual({ url: 'https://shop.com/blog/', kind: 'parent' });
  });

  it('falls back to the site itself', async () => {
    const fix = await findFix('https://shop.com/p/123', page(404, ''), site(['https://shop.com/']));
    expect(fix).toEqual({ url: 'https://shop.com/', kind: 'root' });
  });

  it('suggests nothing when the whole site is gone', async () => {
    expect(await findFix('https://gone.com/a/b', page(404, ''), site([]))).toEqual({ url: '', kind: '' });
  });

  it('notices a page that moved', async () => {
    expect(await findFix('https://a.com/old', page(200, 'https://a.com/new-place'), site([]))).toEqual({ url: 'https://a.com/new-place', kind: 'moved' });
  });

  it('treats a redirect to the home page as "the page is gone"', async () => {
    expect(await findFix('https://a.com/old/item', page(200, 'https://a.com/'), site([]))).toEqual({ url: 'https://a.com/', kind: 'root' });
  });

  it('ignores harmless redirects and login pages', async () => {
    expect(await findFix('http://a.com/x', page(200, 'https://www.a.com/x/'), site([]))).toEqual({ url: '', kind: '' });
    expect(await findFix('https://a.com/private', page(200, 'https://a.com/login?next=/private'), site([]))).toEqual({ url: '', kind: '' });
  });

  it('finds the same page under a lowercase address (Webflow slugs)', async () => {
    const old = 'https://webflow.com/made-in-webflow/website/Joseph-Berry-Text-Effects?s=joseph';
    const fix = await findFix(old, page(404, ''), site([
      'https://webflow.com/made-in-webflow/website/joseph-berry-text-effects',
      'https://webflow.com/made-in-webflow/website',
    ]));
    expect(fix).toEqual({ url: 'https://webflow.com/made-in-webflow/website/joseph-berry-text-effects', kind: 'moved' });
  });

  it('drops a query the site no longer accepts', async () => {
    const fix = await findFix('https://a.com/page?ref=old', page(404, ''), site(['https://a.com/page', 'https://a.com/']));
    expect(fix).toEqual({ url: 'https://a.com/page', kind: 'moved' });
  });
});
