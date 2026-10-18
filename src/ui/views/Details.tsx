import { ArrowUpRight, Camera, ImagePlus, RefreshCw, Star, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { hostOf } from '../../core/normalize';
import { ROOT } from '../../core/types';
import { linkHealth } from '../../enrich/metadata';
import { send } from '../../lib/messages';
import { FolderSelect, Preview, TagInput } from '../components/bits';
import { Badge, Button, cx, Field, IconButton, Input, Modal, Textarea, useConfirm, useToast } from '../components/ui';
import type { Library } from '../hooks';
import { useI18n } from '../i18n';

export function Details({ lib, id, onClose, remote }: { lib: Library; id: string; onClose: () => void; remote: boolean }) {
  const { t, date } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const node = lib.tree.byId.get(id);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [parent, setParent] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    setUrl(node.url);
    setNotes(node.rec.v.notes ?? '');
    setTags(node.rec.v.tags ?? []);
    setParent(node.parent);
    // Reset only when switching to another bookmark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);

  if (!node) return null;
  const v = node.rec.v;
  const health = linkHealth(v.status, v.checkedAt);
  const dirty =
    title !== node.title ||
    url !== node.url ||
    notes !== (v.notes ?? '') ||
    parent !== node.parent ||
    JSON.stringify(tags) !== JSON.stringify(v.tags ?? []);

  const save = async () => {
    setBusy(true);
    try {
      if (title !== node.title || url !== node.url) await send({ type: 'edit', id, title, url: url !== node.url ? url : undefined });
      if (notes !== (v.notes ?? '') || JSON.stringify(tags) !== JSON.stringify(v.tags ?? []))
        await send({ type: 'meta', ids: [id], patch: { notes, tags } });
      if (parent !== node.parent) await send({ type: 'move', ids: [id], parent });
      toast(t('saved'));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ message: t('confirmDelete', { n: 1 }), ok: t('delete'), cancel: t('cancel'), danger: true }))) return;
    try {
      await send({ type: 'remove', ids: [id] });
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => void send({ type: 'image:set', id, dataUrl: String(reader.result) }).catch((e) => toast(e.message, 'error'));
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onMouseDown={onClose}>
      <aside
        className="animate-in flex h-full w-full max-w-[440px] flex-col border-s border-line bg-panel shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">{t('details')}</h2>
          <div className="flex items-center gap-1">
            <IconButton label={v.fav ? t('unfavorite') : t('favorite')} onClick={() => void send({ type: 'meta', ids: [id], patch: { fav: !v.fav } })}>
              <Star className={cx('size-4', v.fav && 'fill-yellow-400 text-yellow-400')} />
            </IconButton>
            <IconButton label={t('delete')} onClick={() => void remove()} className="hover:text-danger">
              <Trash2 className="size-4" />
            </IconButton>
            <IconButton label={t('close')} onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="group relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-hover">
            <Preview node={node} remote={remote} />
            <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5 opacity-0 transition group-hover:opacity-100">
              <button
                onClick={() => void send({ type: 'enrich', ids: [id] })}
                className="flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/70"
              >
                <RefreshCw className="size-3.5" />
                {t('refreshPreview')}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/70"
              >
                <ImagePlus className="size-3.5" />
                {t('uploadImage')}
              </button>
            </div>
            {v.imgSrc && (
              <span className="absolute start-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white backdrop-blur">
                {v.imgSrc === 'shot' ? (
                  <span className="inline-flex items-center gap-1">
                    <Camera className="size-3" />
                    {t('previewScreenshot')}
                  </span>
                ) : v.imgSrc === 'og' ? (
                  t('previewFromSite')
                ) : (
                  t('uploadImage')
                )}
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>

          <a href={node.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-accent hover:underline">
            <span className="ltr truncate">{hostOf(node.url)}</span>
            <ArrowUpRight className="size-4 shrink-0" />
          </a>

          <Field label={t('title')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('url')}>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('folder')}>
            <FolderSelect tree={lib.tree} value={parent} onChange={setParent} />
          </Field>
          <Field label={t('notes')}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notesPlaceholder')} rows={4} />
          </Field>
          <Field label={t('tags')}>
            <TagInput value={tags} onChange={setTags} suggestions={lib.tags.map(([x]) => x)} placeholder={t('tagsPlaceholder')} />
          </Field>

          {v.desc && (
            <div className="rounded-xl bg-hover p-3">
              <div className="mb-1 text-xs font-medium text-muted">{t('siteDescription')}</div>
              <p className="text-[13px] leading-relaxed text-fg/80">{v.desc}</p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted">{t('added')}</dt>
              <dd className="mt-0.5">{date(v.addedAt ?? 0) || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('linkStatus')}</dt>
              <dd className="mt-0.5">
                {health === 'ok' ? (
                  <Badge tone="ok">{t('linkOk')}</Badge>
                ) : health === 'broken' ? (
                  <Badge tone="danger">
                    {t('linkBroken')} {v.status ? `(${v.status})` : ''}
                  </Badge>
                ) : health === 'blocked' ? (
                  <Badge tone="warn">{t('linkBlocked')}</Badge>
                ) : (
                  <Badge>{t('linkUnknown')}</Badge>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button onClick={onClose}>{t('close')}</Button>
          <Button variant="primary" disabled={!dirty} loading={busy} onClick={() => void save()}>
            {t('save')}
          </Button>
        </div>
      </aside>
    </div>
  );
}

export function AddDialog({ lib, open, onClose, folder }: { lib: Library; open: boolean; onClose: () => void; folder?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [parent, setParent] = useState<string>(folder ?? ROOT.other);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setUrl('');
      setTitle('');
      setParent(folder ?? ROOT.other);
    }
  }, [open, folder]);
  const submit = async () => {
    let u = url.trim();
    if (!u) return;
    if (!/^[a-z][\w+.-]*:/i.test(u)) u = 'https://' + u;
    setBusy(true);
    try {
      await send({ type: 'create', parent, title: title.trim() || hostOf(u) || u, url: u });
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('addBookmark')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t('url')}>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://" autoFocus />
        </Field>
        <Field label={t('title')}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t('folder')}>
          <FolderSelect tree={lib.tree} value={parent} onChange={setParent} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!url.trim()}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function FolderDialog({ open, parent, onClose }: { open: boolean; parent: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) setName('');
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={t('newFolder')}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          try {
            await send({ type: 'create', parent, title: name.trim() });
            onClose();
          } catch (err) {
            toast((err as Error).message, 'error');
          }
        }}
      >
        <Field label={t('folderName')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
