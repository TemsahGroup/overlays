import { useEffect, useState } from 'react';
import { STATUS_STALE_MS, subscribeStatus, type StatusMessage } from '../integrations/tikfinity/eventApi/statusChannel';
import { useToast } from './AppShell';
import { useI18n } from './i18n';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('', text);
    return false;
  }
}

interface LinkCardProps {
  /** Portable OBS link, or null when the item is not saved yet. */
  url: string | null;
  /** Browser-only link (optional). */
  storageUrl?: string | null;
  dirty: boolean;
  /** Example size for OBS step 3, e.g. "1920 × 1080". */
  size: string;
}

/** The one thing a streamer needs after designing: the OBS link, plus how to use it. */
export function LinkCard({ url, storageUrl, dirty, size }: LinkCardProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    if (await copyText(text)) {
      setCopied(true);
      toast(t('common.copiedLink'));
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <section className="card link-card">
      <h2 className="card-title">🔗 {t('link.title')}</h2>
      {!url ? (
        <p className="muted">{t('link.needSave')}</p>
      ) : (
        <>
          <button type="button" className="btn primary btn--big" onClick={() => copy(url)}>
            {copied ? t('common.copied') : `📋 ${t('link.copy')}`}
          </button>
          {dirty && <p className="notice notice--info">{t('common.unsaved')}</p>}
          <div className="link-actions">
            <a className="btn btn--ghost" href={`${url}&demo=1`} target="_blank" rel="noreferrer">
              ▶ {t('link.tryIt')} ↗
            </a>
          </div>
          <p className="muted small">{t('link.afterSave')}</p>
        </>
      )}

      <details className="disclosure">
        <summary>{t('obs.title')}</summary>
        <ol className="steps">
          <li>{t('obs.step1')}</li>
          <li>{t('obs.step2')}</li>
          <li>{t('obs.step3', { size })}</li>
          <li>{t('obs.step4')}</li>
          <li>{t('obs.step5')}</li>
        </ol>
      </details>

      {url && (
        <details className="disclosure">
          <summary>{t('common.advanced')}</summary>
          <p className="muted small">{t('link.raw')}</p>
          <code className="url-code" dir="ltr">
            {url}
          </code>
          {storageUrl && (
            <>
              <p className="muted small">{t('link.storage')}</p>
              <code className="url-code" dir="ltr">
                {storageUrl}
              </code>
              <button type="button" className="btn btn--small" onClick={() => copy(storageUrl)}>
                {t('common.copy')}
              </button>
            </>
          )}
          <p className="muted small">{t('link.extras', { setup: '&setup=1', demo: '&demo=1' })}</p>
        </details>
      )}
    </section>
  );
}

/** Status reported by an overlay of this item open in this browser (read-only). */
export function useReportedStatus(configId: string | null): StatusMessage | null {
  const [latest, setLatest] = useState<{ msg: StatusMessage; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setLatest(null);
    return subscribeStatus((msg) => {
      if (msg.configId === configId) setLatest({ msg, at: Date.now() });
    });
  }, [configId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);
  return latest && now - latest.at < STATUS_STALE_MS ? latest.msg : null;
}

/** Friendly TikFinity status. The page never connects itself; it shows what an open overlay reports. */
export function ConnectionCard({ configId }: { configId: string | null }) {
  const { t } = useI18n();
  const reported = useReportedStatus(configId);
  const status = reported?.state.status ?? 'disconnected';
  const verified = !!reported?.state.verifiedGiftAt;
  const label = { disconnected: t('conn.disconnected'), connecting: t('conn.connecting'), connected: t('conn.connected'), error: t('conn.error') }[status];

  return (
    <section className="card">
      <h2 className="card-title">📡 {t('conn.title')}</h2>
      <div className={`conn conn--${status}`}>
        <span className="conn-dot" />
        <b>{label}</b>
        {reported && <span className={`chip ${verified ? 'chip--tikfinity' : 'chip--mock'}`}>{verified ? t('conn.verified') : t('conn.notVerified')}</span>}
      </div>
      <p className="muted small">{reported ? null : t('conn.idle', { setup: '&setup=1' })}</p>
      <p className="muted small">{t('conn.needs')}</p>
      {(status === 'error' || (reported && status === 'disconnected')) && (
        <div className="help-box">
          <b>{t('conn.helpTitle')}</b>
          <ol className="steps">
            <li>{t('conn.help1')}</li>
            <li>{t('conn.help2')}</li>
            <li>{t('conn.help3')}</li>
          </ol>
        </div>
      )}
      {reported && (
        <details className="disclosure">
          <summary>{t('conn.details')}</summary>
          <p className="muted small" dir="ltr">
            {reported.state.detail}
          </p>
          <p className="muted small mono" dir="ltr">
            {reported.state.url} · messages {reported.state.messages}
          </p>
        </details>
      )}
    </section>
  );
}
