import { AppWindow, Camera, Loader2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { send } from '../../lib/messages';
import { useI18n } from '../i18n';
import { cx } from './ui';

/** Desktop size the site is rendered at, then scaled down to fit the box. */
const PAGE_W = 1280;
const PAGE_H = 800;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/**
 * The live site inside the preview box. The user waits or scrolls until it
 * looks right, then "Use this view" crops a screenshot of exactly this box.
 * Sites that refuse to be framed are allowed to load here (and only here).
 */
export function LiveFrame({
  url,
  onCapture,
  onClose,
  onWindow,
}: {
  url: string;
  onCapture: (dataUrl: string) => Promise<void>;
  onClose: () => void;
  /** Fallback: screenshot in a separate window. */
  onWindow: () => void;
}) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [src, setSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.clientWidth && setScale(el.clientWidth / PAGE_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    void send({ type: 'frame:allow' })
      .catch(() => undefined)
      .then(() => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [url]);

  const capture = async () => {
    const el = box.current;
    if (!el) return;
    setCapturing(true);
    try {
      await nextFrame(); // controls are hidden for the picture
      const win = await browser.windows.getCurrent();
      const shot = await browser.tabs.captureVisibleTab(win.id!, { format: 'png' });
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const bmp = await createImageBitmap(await (await fetch(shot)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.getContext('2d')!.drawImage(bmp, r.left * dpr, r.top * dpr, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      await onCapture(canvas.toDataURL('image/png'));
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div ref={box} className="relative h-full w-full overflow-hidden bg-white" dir="ltr">
      {src && (
        <iframe
          src={src}
          title="live"
          // No top navigation: a page cannot take over Xezina.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoaded(true)}
          // `zoom`, not a transform: a transformed cross-site frame may not be painted.
          style={{ width: PAGE_W, height: PAGE_H, zoom: scale, border: 0 }}
        />
      )}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-hover text-xs text-muted">
          <Loader2 className="size-4 animate-spin" />
          {t('liveLoading')}
        </div>
      )}
      {!capturing && (
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-end gap-1.5" dir="auto">
          <button
            onClick={() => void capture()}
            className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-fg shadow hover:opacity-90"
          >
            <Camera className="size-3.5" />
            {t('useThisView')}
          </button>
          <button onClick={onWindow} className={cx('flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/70')}>
            <AppWindow className="size-3.5" />
            {t('openInWindow')}
          </button>
          <button onClick={onClose} className="flex items-center rounded-md bg-black/55 px-1.5 py-1 text-white backdrop-blur hover:bg-black/70" title={t('close')}>
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
