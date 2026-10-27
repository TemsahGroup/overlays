import { useEffect, useState, type ReactNode } from 'react';
import type {
  DiagnosticEntry,
  LiveState,
  LiveStatus,
  TikFinityEventApiAdapter,
} from '../../integrations/tikfinity/eventApi/TikFinityEventApiAdapter';

export const LIVE_STATUS_LABEL: Record<LiveStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Error',
};

/** Steps shown whenever TikFinity Desktop cannot be reached. */
export function NotRunningHelp() {
  return (
    <ol className="steps">
      <li>Start <b>TikFinity Desktop</b> on this same computer (the Event API is a desktop-app feature).</li>
      <li>In TikFinity, connect it to your TikTok LIVE.</li>
      <li>Keep this overlay open — it retries automatically.</li>
      <li>
        Still failing? Check that nothing blocks <code>ws://127.0.0.1:21213/</code> (firewall, another app on port 21213).
      </li>
    </ol>
  );
}

function since(t: number | null): string {
  if (!t) return 'never';
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

interface Props {
  live: boolean;
  state: LiveState | null;
  adapter: TikFinityEventApiAdapter | null;
  diag: boolean;
  /** Page-specific setup controls (e.g. leaderboard reset). */
  extra?: ReactNode;
}

/** Overlay setup view (?setup=1): explicit connection status, never shown otherwise. */
export function LiveStatusPanel({ live, state, adapter, diag, extra }: Props) {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!diag || !adapter) return;
    setEntries(adapter.recentDiagnostics);
    return adapter.onDiagnostic(() => setEntries([...adapter.recentDiagnostics]));
  }, [diag, adapter]);

  // Refresh "x s ago" labels.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!live) {
    return (
      <aside className="live-panel">
        <div className="conn conn--disconnected">
          <span className="conn-dot" />
          <b>Live connection off</b>
          <span className="chip chip--mock">?live=0</span>
        </div>
        {extra}
      </aside>
    );
  }

  const status = state?.status ?? 'disconnected';
  const verified = !!state?.verifiedGiftAt;
  return (
    <aside className="live-panel" aria-live="polite">
      <div className={`conn conn--${status}`}>
        <span className="conn-dot" />
        <b>TikFinity: {LIVE_STATUS_LABEL[status]}</b>
        <span className={`chip ${verified ? 'chip--tikfinity' : 'chip--mock'}`}>{verified ? 'LIVE GIFTS VERIFIED' : 'NOT VERIFIED LIVE'}</span>
      </div>
      <p className="hint">{state?.detail ?? 'Waiting for configuration…'}</p>
      {state && (
        <p className="hint mono">
          {state.url} · messages {state.messages} (last {since(state.lastMessageAt)}) · final gifts received {state.giftsReceived} · like batches {state.likesReceived} · chat messages {state.chatsReceived}
          {state.layout ? ` · payload layout ${state.layout}` : ''}
        </p>
      )}
      {(status === 'error' || status === 'disconnected') && <NotRunningHelp />}
      {extra}

      {diag && (
        <div className="diag">
          <h3>Diagnostics (dev only · values removed, users masked)</h3>
          {!entries.length && <p className="hint">No messages received yet.</p>}
          <ul>
            {entries.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <div className="diag-head">
                  <time>{new Date(e.at).toLocaleTimeString()}</time>
                  {e.kind === 'malformed' ? (
                    <span className="chip chip--error">MALFORMED · {e.reason}</span>
                  ) : (
                    <>
                      <b>{e.event}</b>
                      {!e.known && <span className="chip chip--error">UNDOCUMENTED EVENT</span>}
                      {e.gift && <span className="chip">{e.gift.status} · {e.gift.layout}</span>}
                      {e.chat && <span className="chip">chat {e.chat.status} · {e.chat.length ?? 0} chars</span>}
                    </>
                  )}
                </div>
                {e.gift && (
                  <p className="hint mono">
                    giftId={e.gift.giftId ?? '—'} giftName={e.gift.giftName ?? '—'} giftType={e.gift.giftType ?? '—'} repeatCount=
                    {e.gift.repeatCount ?? '—'} repeatEnd={String(e.gift.repeatEnd ?? '—')} diamondCount={e.gift.diamondCount ?? '—'} user=
                    {e.gift.user ?? '—'}
                    {e.gift.missing.length ? ` · missing: ${e.gift.missing.join(', ')}` : ''}
                  </p>
                )}
                {e.like && (
                  <p className="hint mono">
                    like: {e.like.status} likeCount={e.like.likeCount ?? '—'} user={e.like.user ?? '—'}
                    {e.like.missing.length ? ` · missing: ${e.like.missing.join(', ')}` : ''}
                  </p>
                )}
                {e.shape !== undefined && <pre>{JSON.stringify(e.shape, null, 1)}</pre>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
