import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  KeyRound,
  Lock,
  RotateCcw,
  Server,
  ShieldCheck,
  Star,
  Keyboard,
  Upload,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { db } from '../../db/db';
import { send } from '../../lib/messages';
import type { Settings as SettingsT } from '../../lib/settings';
import { guessDeviceName } from '../../lib/settings';
import type { DeviceCode, GitHubConfig } from '../../storage/github';
import { BUILT_IN_CLIENT_IDS } from '../../storage/oauth';
import { originsFor, type RemoteConfig, type RemoteType } from '../../storage/registry';
import type { S3Config } from '../../storage/s3';
import type { WebDavConfig } from '../../storage/webdav';
import { Badge, Button, Card, cx, Field, Input, Select, Switch, useConfirm, useToast } from '../components/ui';
import { useEnrichStatus, useSettings, useStatus, type Library } from '../hooks';
import { LANGUAGES, useI18n, type StringKey } from '../i18n';
import { exportHtml, exportJson, importHtml } from '../transfer';
import { GithubIcon, Logo } from './Logo';

const TABS = ['general', 'sync', 'previews', 'backups', 'advanced', 'about'] as const;
const TAB_KEYS: Record<(typeof TABS)[number], StringKey> = {
  general: 'tabGeneral',
  sync: 'tabSync',
  previews: 'tabPreviews',
  backups: 'tabBackups',
  advanced: 'tabAdvanced',
  about: 'tabAbout',
};

export const REPO_URL = 'https://github.com/mostafasadeghidev/xezina';
export const SITE_URL = 'https://mostafasadeghidev.github.io/xezina/';

export function SettingsView({ tab, go, lib }: { tab: string; go: (r: string) => void; lib: Library }) {
  const { t } = useI18n();
  const current = (TABS as readonly string[]).includes(tab) ? (tab as (typeof TABS)[number]) : 'general';
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight">{t('settingsTitle')}</h1>
        <div className="mt-5 flex flex-wrap gap-x-1 border-b border-line">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => go(`/settings/${k}`)}
              className={cx(
                '-mb-px whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm transition',
                current === k ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {t(TAB_KEYS[k])}
            </button>
          ))}
        </div>
        <div className="mt-6 space-y-6">
          {current === 'general' && (
            <>
              <General />
              <Bookmarking />
            </>
          )}
          {current === 'sync' && <SyncTab />}
          {current === 'previews' && <PreviewsTab />}
          {current === 'backups' && <BackupsTab lib={lib} />}
          {current === 'advanced' && <AdvancedTab />}
          {current === 'about' && <About />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children, icon }: { title: string; hint?: ReactNode; children: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        {icon && <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</div>}
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-1 text-sm leading-relaxed text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function useRun() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, okText?: string) => {
    setBusy(key);
    try {
      await fn();
      if (okText) toast(okText);
      return true;
    } catch (e) {
      toast((e as Error).message, 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

// ---------------------------------------------------------------- general

function General() {
  const { t } = useI18n();
  const [s, update] = useSettings();
  const [name, setName] = useState(s.deviceName);
  useEffect(() => setName(s.deviceName), [s.deviceName]);
  return (
    <Section title={t('tabGeneral')}>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t('language')}>
          <Select value={s.lang} onChange={(e) => void update({ lang: e.target.value as SettingsT['lang'] })}>
            <option value="auto">{t('languageAuto')}</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('theme')}>
          <Select value={s.theme} onChange={(e) => void update({ theme: e.target.value as SettingsT['theme'] })}>
            <option value="system">{t('themeSystem')}</option>
            <option value="dark">{t('themeDark')}</option>
            <option value="light">{t('themeLight')}</option>
          </Select>
        </Field>
        <Field label={t('deviceName')} hint={t('deviceNameHint')}>
          <Input value={name} placeholder={guessDeviceName()} onChange={(e) => setName(e.target.value)} onBlur={() => void update({ deviceName: name.trim() })} />
        </Field>
      </div>
    </Section>
  );
}

function Bookmarking() {
  const { t } = useI18n();
  const [s, update] = useSettings();
  const [keys, setKeys] = useState<{ name?: string; shortcut?: string }[]>([]);
  useEffect(() => {
    void browser.commands?.getAll().then(setKeys).catch(() => undefined);
  }, []);
  const key = (name: string) => keys.find((k) => k.name === name)?.shortcut || '—';
  const saveCmd = keys.some((k) => k.name === '_execute_browser_action') ? '_execute_browser_action' : '_execute_action';
  const isFirefox = import.meta.env.FIREFOX;
  const isEdge = /Edg\//.test(navigator.userAgent);
  return (
    <>
      <Section title={t('bookmarkingTitle')} icon={<Star className="size-4" />}>
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium">{t('starTitle')}</legend>
            <p className="text-xs leading-relaxed text-muted">{t('starHint')}</p>
            {(['popup', 'notify', 'none'] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="afterStar"
                  checked={s.afterStar === v}
                  onChange={() => void update({ afterStar: v })}
                  className="size-4 accent-[var(--accent)]"
                />
                {t(v === 'popup' ? 'starPopup' : v === 'notify' ? 'starNotify' : 'starNone')}
              </label>
            ))}
          </fieldset>
        </div>
      </Section>
      <Section title={t('shortcutsTitle')} icon={<Keyboard className="size-4" />}>
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt>{t('shortcutSave')}</dt>
            <dd>
              <kbd className="rounded-md border border-line bg-hover px-2 py-0.5 text-xs" dir="ltr">
                {key(saveCmd)}
              </kbd>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt>{t('shortcutManager')}</dt>
            <dd>
              <kbd className="rounded-md border border-line bg-hover px-2 py-0.5 text-xs" dir="ltr">
                {key('open-manager')}
              </kbd>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt>
              {t('omniboxLabel')}
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t('omniboxHint')}</span>
            </dt>
            <dd className="shrink-0">
              <kbd className="rounded-md border border-line bg-hover px-2 py-0.5 text-xs" dir="ltr">
                bm + Space
              </kbd>
            </dd>
          </div>
        </dl>
        {!isFirefox && (
          <Button
            size="sm"
            className="mt-4"
            onClick={() => void browser.tabs.create({ url: isEdge ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts' })}
          >
            {t('shortcutsChange')}
          </Button>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- sync

const PROVIDERS: { type: RemoteType; icon: ReactNode; name: StringKey; hint: StringKey }[] = [
  { type: 'gdrive', icon: <Cloud className="size-5" />, name: 'providerGdrive', hint: 'providerGdriveHint' },
  { type: 'dropbox', icon: <Cloud className="size-5" />, name: 'providerDropbox', hint: 'providerDropboxHint' },
  { type: 'onedrive', icon: <Cloud className="size-5" />, name: 'providerOnedrive', hint: 'providerOnedriveHint' },
  { type: 'webdav', icon: <Server className="size-5" />, name: 'providerWebdav', hint: 'providerWebdavHint' },
  { type: 's3', icon: <HardDrive className="size-5" />, name: 'providerS3', hint: 'providerS3Hint' },
  { type: 'github', icon: <GithubIcon className="size-5" />, name: 'providerGithub', hint: 'providerGithubHint' },
];

export function providerName(type: RemoteType, t: (k: StringKey) => string) {
  return t(PROVIDERS.find((p) => p.type === type)!.name);
}

async function ensureOrigins(cfg: RemoteConfig): Promise<boolean> {
  const origins = originsFor(cfg);
  if (!origins.length) return true;
  if (await browser.permissions.contains({ origins })) return true;
  return browser.permissions.request({ origins });
}

function SyncTab() {
  const { t, ago } = useI18n();
  const [s, update] = useSettings();
  const status = useStatus();
  const confirm = useConfirm();
  const { busy, run } = useRun();
  const [picked, setPicked] = useState<RemoteType | null>(null);

  if (!s.remote) {
    return (
      <>
        <Section title={t('storageTitle')} hint={t('storageHint')} icon={<Cloud className="size-4" />}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.type}
                onClick={() => setPicked(p.type)}
                className={cx(
                  'flex items-start gap-3 rounded-xl border p-4 text-start transition hover:border-accent/50 hover:bg-hover',
                  picked === p.type ? 'border-accent bg-accent-soft/40 ring-2 ring-accent/20' : 'border-line',
                )}
              >
                <span className="mt-0.5 text-accent">{p.icon}</span>
                <span>
                  <span className="block text-sm font-semibold">{t(p.name)}</span>
                  <span className="mt-0.5 block text-xs text-muted">{t(p.hint)}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
        {picked && <ProviderForm type={picked} key={picked} />}
      </>
    );
  }

  const remote = s.remote;
  return (
    <>
      <Section title={t('storageCurrent', { name: providerName(remote.type, t) })} icon={<Check className="size-4" />}>
        <div className="flex flex-wrap items-center gap-3">
          {status.state === 'error' && <Badge tone="danger">{t('statusError')}</Badge>}
          {status.state === 'idle' && <Badge tone="ok">{t('statusIdle')}</Badge>}
          <span className="text-sm text-muted">
            {t('statLastSync')}: {ago(status.lastSync)}
          </span>
          <div className="ms-auto flex gap-2">
            <Button variant="primary" loading={status.state === 'running' || busy === 'sync'} onClick={() => void run('sync', () => send({ type: 'sync' }))}>
              {t('syncNow')}
            </Button>
            <Button
              variant="danger"
              onClick={() => void run('off', () => send({ type: 'remote:set', config: null }))}
            >
              {t('disconnect')}
            </Button>
          </div>
        </div>
        {status.lastError && status.state !== 'idle' && status.state !== 'running' && (
          <p className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{status.lastError}</p>
        )}
        {status.state === 'confirm' && status.pendingDeletes && (
          <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-4">
            <p className="text-sm">{t('confirmMassDelete', { count: status.pendingDeletes.count, total: status.pendingDeletes.total })}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="warn" onClick={() => void run('apply', () => send({ type: 'sync', allowMassDelete: true }))}>
                {t('confirmContinue')}
              </Button>
              <Button onClick={() => void run('push', () => send({ type: 'sync', mode: 'push' }))}>{t('confirmPull')}</Button>
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-line pt-5">
          <Switch checked={s.autoSync} onChange={(v) => void update({ autoSync: v }).then(() => send({ type: 'reschedule' }))} label={t('autoSync')} />
          <label className="flex items-center gap-2 text-sm">
            {t('interval')}
            <Select
              value={String(s.intervalMin)}
              onChange={(e) => void update({ intervalMin: Number(e.target.value) }).then(() => send({ type: 'reschedule' }))}
              className="!h-8 !w-20"
            >
              {[1, 5, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            {t('minutes')}
          </label>
        </div>
      </Section>

      <EncryptionSection />

      <Section title={t('forcePush')} hint={t('forcePushHint')} icon={<ArrowUpFromLine className="size-4" />}>
        <div className="flex flex-wrap gap-3">
          <Button
            icon={<ArrowUpFromLine className="size-4" />}
            loading={busy === 'fpush'}
            onClick={async () => {
              if (await confirm({ message: t('confirmForcePush'), ok: t('forcePush'), cancel: t('cancel'), danger: true }))
                void run('fpush', () => send({ type: 'sync', mode: 'push' }), t('done'));
            }}
          >
            {t('forcePush')}
          </Button>
          <Button
            icon={<ArrowDownToLine className="size-4" />}
            loading={busy === 'fpull'}
            onClick={async () => {
              if (await confirm({ message: t('confirmForcePull'), ok: t('forcePull'), cancel: t('cancel'), danger: true }))
                void run('fpull', () => send({ type: 'sync', mode: 'pull' }), t('done'));
            }}
          >
            {t('forcePull')}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">{t('forcePullHint')}</p>
      </Section>
    </>
  );
}

function EncryptionSection() {
  const { t } = useI18n();
  const [s] = useSettings();
  const status = useStatus();
  const { busy, run } = useRun();
  const [pass, setPass] = useState('');
  const needsKey = status.state === 'needs-key';
  return (
    <Section title={t('encryption')} hint={t('encryptionHint')} icon={<ShieldCheck className="size-4" />}>
      {s.encryption.enabled && !needsKey ? (
        <div className="flex items-center gap-3">
          <Badge tone="ok">
            <Lock className="size-3" />
            {t('encryptionOn')}
          </Badge>
          <Button size="sm" loading={busy === 'off'} onClick={() => void run('off', () => send({ type: 'encryption:set', passphrase: null }))}>
            {t('disable')}
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pass.length >= 6) void run('on', () => send({ type: 'encryption:set', passphrase: pass }), t('done')).then((ok) => ok && setPass(''));
          }}
        >
          <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t('passphrase')} className="max-w-xs" autoComplete="new-password" />
          <Button type="submit" variant="primary" icon={<KeyRound className="size-4" />} loading={busy === 'on'} disabled={pass.length < 6}>
            {needsKey ? t('unlock') : t('enable')}
          </Button>
        </form>
      )}
    </Section>
  );
}

function ProviderForm({ type }: { type: RemoteType }) {
  const { t } = useI18n();
  const [s] = useSettings();
  const { busy, run } = useRun();
  const toast = useToast();

  if (type === 'gdrive' || type === 'dropbox' || type === 'onedrive') {
    const clientId = s.clientIds[type] || BUILT_IN_CLIENT_IDS[type];
    return (
      <Section title={t(PROVIDERS.find((p) => p.type === type)!.name)} hint={t(PROVIDERS.find((p) => p.type === type)!.hint)}>
        {clientId ? (
          <Button variant="primary" loading={busy === 'oauth'} onClick={() => void run('oauth', () => send({ type: 'oauth:connect', provider: type }), t('done'))}>
            {t('signInWith', { name: providerName(type, t) })}
          </Button>
        ) : (
          <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">
            {t('clientIdsHint')} <a className="underline" href="#/settings/advanced">{t('tabAdvanced')}</a>
          </p>
        )}
      </Section>
    );
  }

  if (type === 'webdav') {
    return (
      <ConfigForm<WebDavConfig>
        initial={{ type: 'webdav', url: '', username: '', password: '', folder: 'Xezina' }}
        fields={[
          { key: 'url', label: t('fieldServerUrl'), hint: t('fieldServerUrlHint'), ltr: true },
          { key: 'username', label: t('fieldUsername') },
          { key: 'password', label: t('fieldPassword'), secret: true },
          { key: 'folder', label: t('fieldFolder') },
        ]}
        title={t('providerWebdav')}
      />
    );
  }

  if (type === 's3') {
    return (
      <ConfigForm<S3Config>
        initial={{ type: 's3', endpoint: '', region: 'auto', bucket: '', accessKeyId: '', secretAccessKey: '', prefix: 'xezina', pathStyle: true }}
        fields={[
          { key: 'endpoint', label: t('fieldEndpoint'), hint: t('fieldEndpointHint'), ltr: true },
          { key: 'bucket', label: t('fieldBucket'), ltr: true },
          { key: 'region', label: t('fieldRegion'), ltr: true },
          { key: 'prefix', label: t('fieldFolder'), ltr: true },
          { key: 'accessKeyId', label: t('fieldAccessKey'), ltr: true },
          { key: 'secretAccessKey', label: t('fieldSecretKey'), secret: true },
          { key: 'pathStyle', label: t('fieldPathStyle'), bool: true },
        ]}
        title={t('providerS3')}
      />
    );
  }

  return <GitHubForm onError={(m) => toast(m, 'error')} />;
}

interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  hint?: string;
  secret?: boolean;
  ltr?: boolean;
  bool?: boolean;
}

function ConfigForm<T extends RemoteConfig>({ initial, fields, title }: { initial: T; fields: FieldDef<T>[]; title: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const { busy, run } = useRun();
  const [cfg, setCfg] = useState<T>(initial);
  const set = (k: keyof T, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));
  const test = async () => {
    if (!(await ensureOrigins(cfg))) return toast(t('permissionNeeded'), 'error');
    await run('test', async () => {
      const r = await send<{ files: number }>({ type: 'remote:test', config: cfg });
      toast(t('testOk', { n: r.files }));
    });
  };
  const save = async () => {
    if (!(await ensureOrigins(cfg))) return toast(t('permissionNeeded'), 'error');
    await run('save', async () => {
      await send({ type: 'remote:test', config: cfg });
      await send({ type: 'remote:set', config: cfg });
    }, t('done'));
  };
  return (
    <Section title={title}>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {fields.map((f) =>
          f.bool ? (
            <div key={f.key} className="md:col-span-2">
              <Switch checked={Boolean(cfg[f.key])} onChange={(v) => set(f.key, v)} label={f.label} />
            </div>
          ) : (
            <div key={f.key} className={cx(f.hint && 'md:col-span-2')}>
              <Field label={f.label} hint={f.hint}>
                <Input
                  type={f.secret ? 'password' : 'text'}
                  dir={f.ltr || f.secret ? 'ltr' : undefined}
                  value={String(cfg[f.key] ?? '')}
                  onChange={(e) => set(f.key, e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </div>
          ),
        )}
        <div className="flex gap-2 md:col-span-2">
          <Button type="button" loading={busy === 'test'} onClick={() => void test()}>
            {t('testConnection')}
          </Button>
          <Button type="submit" variant="primary" loading={busy === 'save'}>
            {t('saveAndConnect')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function GitHubForm({ onError }: { onError: (m: string) => void }) {
  const { t } = useI18n();
  const [s] = useSettings();
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [copied, setCopied] = useState(false);
  const hasClient = !!(s.clientIds.github || BUILT_IN_CLIENT_IDS.github);
  const tokenUrl =
    'https://github.com/settings/personal-access-tokens/new?name=Xezina&description=Xezina%20bookmark%20sync&contents=write';

  const startDevice = async () => {
    try {
      const c = await send<DeviceCode>({ type: 'github:device-start' });
      setCode(c);
      void browser.tabs.create({ url: c.verification_uri });
      await send({ type: 'github:device-finish', code: c });
      setCode(null);
    } catch (e) {
      setCode(null);
      onError((e as Error).message);
    }
  };

  return (
    <>
      {hasClient && (
        <Section title={t('githubDevice')} icon={<GithubIcon className="size-4" />}>
          {code ? (
            <div className="space-y-3">
              <p className="text-sm">{t('githubDeviceHint', { url: code.verification_uri })}</p>
              <div className="flex items-center gap-3">
                <code className="rounded-lg bg-hover px-4 py-2 text-2xl font-bold tracking-[0.3em]" dir="ltr">
                  {code.user_code}
                </code>
                <Button
                  size="sm"
                  icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  onClick={() => {
                    void navigator.clipboard.writeText(code.user_code);
                    setCopied(true);
                  }}
                >
                  {copied ? t('copied') : t('copy')}
                </Button>
              </div>
              <p className="text-xs text-muted">{t('githubWaiting')}</p>
            </div>
          ) : (
            <Button variant="primary" icon={<GithubIcon className="size-4" />} onClick={() => void startDevice()}>
              {t('githubDevice')}
            </Button>
          )}
        </Section>
      )}
      <ConfigForm<GitHubConfig>
        initial={{ type: 'github', token: '', owner: '', repo: 'xezina-data', branch: '', dir: 'xezina' }}
        fields={[
          { key: 'token', label: t('fieldToken'), hint: t('fieldTokenHint'), secret: true },
          { key: 'owner', label: t('fieldOwner'), ltr: true },
          { key: 'repo', label: t('fieldRepo'), ltr: true },
          { key: 'branch', label: t('fieldBranch'), ltr: true },
          { key: 'dir', label: t('fieldFolder'), ltr: true },
        ]}
        title={hasClient ? t('orUseToken') : t('providerGithub')}
      />
      <a href={tokenUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
        {t('createToken')}
        <ExternalLink className="size-3.5" />
      </a>
    </>
  );
}

// ---------------------------------------------------------------- previews

function PreviewsTab() {
  const { t } = useI18n();
  const [s, update] = useSettings();
  const enrich = useEnrichStatus();
  const [granted, setGranted] = useState<boolean | null>(null);
  useEffect(() => {
    void browser.permissions.contains({ origins: ['<all_urls>'] }).then(setGranted);
  }, []);
  const grant = async () => {
    const ok = await browser.permissions.request({ origins: ['<all_urls>'] });
    setGranted(ok);
    if (ok) void send({ type: 'enrich' });
  };
  const setP = (patch: Partial<SettingsT['previews']>) => void update({ previews: { ...s.previews, ...patch } });
  return (
    <Section title={t('previewsTitle')} hint={t('previewsHint')}>
      <div className="space-y-5">
        {granted ? (
          <Badge tone="ok">
            <Check className="size-3" />
            {t('accessGranted')}
          </Badge>
        ) : (
          <Button variant="primary" onClick={() => void grant()}>
            {t('grantAccess')}
          </Button>
        )}
        <div className="space-y-3">
          <Switch checked={s.previews.fetchMeta} onChange={(v) => setP({ fetchMeta: v })} label={t('fetchMeta')} disabled={!granted} />
          <Switch checked={s.previews.autoCapture} onChange={(v) => setP({ autoCapture: v })} label={t('autoCapture')} disabled={!granted} />
          <Switch checked={s.previews.syncImages} onChange={(v) => setP({ syncImages: v })} label={t('syncImages')} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          {enrich.running ? (
            <>
              <Button onClick={() => void send({ type: 'enrich:stop' })}>{t('stop')}</Button>
              <span className="text-sm text-muted">{t('previewsDone', { done: enrich.done, total: enrich.total })}</span>
            </>
          ) : (
            <>
              <Button variant="primary" disabled={!granted} onClick={() => void send({ type: 'enrich' })}>
                {t('fetchAll')}
              </Button>
              <Button disabled={!granted} onClick={() => void send({ type: 'enrich', force: true })}>
                {t('recheckAll')}
              </Button>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- backups

function BackupsTab({ lib }: { lib: Library }) {
  const { t, num, date, ago } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const { busy, run } = useRun();
  const backups = useLiveQuery(() => db.backups.orderBy('at').reverse().toArray(), []) ?? [];
  return (
    <>
      <Section title={t('backupsTitle')} hint={t('backupsHint')} icon={<RotateCcw className="size-4" />}>
        <Button loading={busy === 'b'} onClick={() => void run('b', () => send({ type: 'backup:create' }), t('done'))}>
          {t('backupNow')}
        </Button>
        {backups.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t('noBackups')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {backups.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex-1">
                  {date(b.at)} <span className="text-muted">· {ago(b.at)}</span>
                </span>
                <Badge>{b.reason}</Badge>
                <span className="w-28 text-end text-xs text-muted">{t('backupItems', { n: b.count })}</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (await confirm({ message: t('confirmRestore'), ok: t('restore'), cancel: t('cancel'), danger: true }))
                      void run('r' + b.id, () => send({ type: 'backup:restore', id: b.id! }), t('done'));
                  }}
                  loading={busy === 'r' + b.id}
                >
                  {t('restore')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('exportTitle')} icon={<Download className="size-4" />}>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download className="size-4" />} onClick={() => exportHtml(lib.tree)}>
            {t('exportHtml')}
          </Button>
          <Button icon={<Download className="size-4" />} onClick={() => exportJson(lib.tree)}>
            {t('exportJson')}
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-medium hover:bg-hover">
            <Upload className="size-4" />
            {t('importHtml')}
            <input
              type="file"
              accept=".html,.htm,text/html"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const r = await importHtml(await file.text());
                  toast(t('imported', { n: num(r.count), folder: r.folder }));
                } catch (err) {
                  toast((err as Error).message, 'error');
                }
              }}
            />
          </label>
        </div>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------- advanced & about

function AdvancedTab() {
  const { t } = useI18n();
  const [s, update] = useSettings();
  const [ids, setIds] = useState(s.clientIds);
  useEffect(() => setIds(s.clientIds), [s.clientIds]);
  let redirect = '';
  try {
    redirect = browser.identity.getRedirectURL();
  } catch {
    redirect = '';
  }
  const rows: { key: keyof SettingsT['clientIds']; label: string }[] = [
    { key: 'gdrive', label: 'Google (OAuth client ID, type “Web application”)' },
    { key: 'dropbox', label: 'Dropbox (App key)' },
    { key: 'onedrive', label: 'Microsoft (Application ID, platform “Single-page application”)' },
    { key: 'github', label: 'GitHub (OAuth App client ID, device flow enabled)' },
  ];
  return (
    <Section title={t('clientIdsTitle')} hint={t('clientIdsHint')}>
      {redirect && (
        <code className="mb-5 block select-all rounded-lg bg-hover px-3 py-2 text-xs" dir="ltr">
          {redirect}
        </code>
      )}
      <div className="space-y-4">
        {rows.map((r) => (
          <Field key={r.key} label={r.label}>
            <Input
              dir="ltr"
              value={ids[r.key] ?? ''}
              placeholder={BUILT_IN_CLIENT_IDS[r.key] || ''}
              onChange={(e) => setIds({ ...ids, [r.key]: e.target.value.trim() })}
              onBlur={() => void update({ clientIds: ids })}
            />
          </Field>
        ))}
      </div>
    </Section>
  );
}

function About() {
  const { t } = useI18n();
  const version = browser.runtime.getManifest().version;
  return (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <Logo className="size-14" />
        <div>
          <div className="text-xl font-bold">Xezina</div>
          <div className="text-sm text-muted">
            {t('version')} {version}
          </div>
        </div>
      </div>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-fg/85">{t('aboutText')}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          <Button icon={<GithubIcon className="size-4" />}>{t('sourceCode')}</Button>
        </a>
        <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
          <Button>{t('reportIssue')}</Button>
        </a>
        <a href={`${SITE_URL}privacy.html`} target="_blank" rel="noreferrer">
          <Button>{t('privacy')}</Button>
        </a>
      </div>
    </Card>
  );
}
