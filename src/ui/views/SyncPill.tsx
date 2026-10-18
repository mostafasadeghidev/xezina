import { AlertCircle, CheckCircle2, CloudOff, KeyRound, Loader2 } from 'lucide-react';
import { useSettings, useStatus } from '../hooks';
import { useI18n } from '../i18n';
import { cx } from '../components/ui';

export function SyncPill({ onOpen }: { onOpen: () => void }) {
  const { t, ago } = useI18n();
  const status = useStatus();
  const [settings] = useSettings();
  let icon = <CloudOff className="size-4" />;
  let label = t('statusLocal');
  let tone = 'text-muted';
  if (settings.remote) {
    switch (status.state) {
      case 'running':
        icon = <Loader2 className="size-4 animate-spin" />;
        label = t('statusRunning');
        tone = 'text-accent';
        break;
      case 'error':
        icon = <AlertCircle className="size-4" />;
        label = t('statusError');
        tone = 'text-danger';
        break;
      case 'confirm':
        icon = <AlertCircle className="size-4" />;
        label = t('statusConfirm');
        tone = 'text-warn';
        break;
      case 'needs-key':
        icon = <KeyRound className="size-4" />;
        label = t('statusNeedsKey');
        tone = 'text-warn';
        break;
      default:
        icon = <CheckCircle2 className="size-4" />;
        label = t('statusIdle');
        tone = 'text-ok';
    }
  }
  return (
    <button onClick={onOpen} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition hover:bg-hover">
      <span className={cx('shrink-0', tone)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[13px] font-medium', tone)}>{label}</span>
        {settings.remote && status.state !== 'running' && (
          <span className="block truncate text-[11px] text-muted">{status.lastError && status.state !== 'idle' ? status.lastError : ago(status.lastSync)}</span>
        )}
      </span>
    </button>
  );
}
