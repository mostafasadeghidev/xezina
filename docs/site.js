/* Picks a language, fills [data-i18n] elements, and wires the small bits of interaction. */
(function () {
  const LANGS = [
    ['en', 'English', false],
    ['fa', 'فارسی', true],
    ['ckb', 'کوردی', true],
    ['ar', 'العربية', true],
    ['de', 'Deutsch', false],
    ['fr', 'Français', false],
    ['it', 'Italiano', false],
    ['pt', 'Português', false],
  ];
  const dicts = window.XZ || {};

  function pick() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl && dicts[fromUrl]) return fromUrl;
    try {
      const saved = localStorage.getItem('xz-lang');
      if (saved && dicts[saved]) return saved;
    } catch (e) {}
    for (const l of navigator.languages || [navigator.language]) {
      const c = (l || '').toLowerCase();
      if (c.startsWith('ckb') || c === 'ku-iq') return 'ckb';
      const base = c.split('-')[0];
      if (dicts[base]) return base;
    }
    return 'en';
  }

  function apply(lang) {
    const d = Object.assign({}, dicts.en, dicts[lang]);
    const meta = LANGS.find((l) => l[0] === lang) || LANGS[0];
    document.documentElement.lang = lang;
    document.documentElement.dir = meta[2] ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = d[el.getAttribute('data-i18n')];
      if (v != null) el.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const v = d[el.getAttribute('data-i18n-alt')];
      if (v != null) el.setAttribute('alt', v);
    });
    document.querySelectorAll('img[data-rtl-src]').forEach((img) => {
      if (!img.dataset.ltrSrc) img.dataset.ltrSrc = img.getAttribute('src');
      img.setAttribute('src', meta[2] ? img.dataset.rtlSrc : img.dataset.ltrSrc);
    });
    const page = document.body.getAttribute('data-page');
    document.title = page === 'privacy' ? `Xezina — ${d.pv_title}` : d.meta_title;
    const desc = document.querySelector('meta[name=description]');
    if (desc) desc.setAttribute('content', d.meta_description);
    // Keep the language when moving between pages.
    document.querySelectorAll('a[data-keep-lang]').forEach((a) => {
      const url = new URL(a.getAttribute('href'), location.href);
      url.searchParams.set('lang', lang);
      a.setAttribute('href', url.pathname.split('/').pop() + url.search + url.hash);
    });
  }

  const select = document.getElementById('lang');
  let lang = pick();
  if (select) {
    select.innerHTML = LANGS.filter((l) => dicts[l[0]])
      .map((l) => `<option value="${l[0]}">${l[1]}</option>`)
      .join('');
    select.value = lang;
    select.addEventListener('change', () => {
      lang = select.value;
      try {
        localStorage.setItem('xz-lang', lang);
      } catch (e) {}
      const url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url);
      apply(lang);
    });
  }
  apply(lang);

  // Screenshot gallery tabs.
  const tabs = document.querySelectorAll('.gallery-tabs button');
  const imgs = document.querySelectorAll('.gallery img');
  tabs.forEach((btn, i) =>
    btn.addEventListener('click', () => {
      tabs.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
      imgs.forEach((im, j) => im.classList.toggle('on', i === j));
    }),
  );

  const y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());
})();
