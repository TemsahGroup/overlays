import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveStatusPanel } from '../../builder/components/LiveStatusPanel';
import { decodeJson } from '../../builder/repository/portable';
import type { OverlayFlags } from '../../builder/route';
import { createStatusPublisher, STATUS_HEARTBEAT_MS } from '../../integrations/tikfinity/eventApi/statusChannel';
import {
  DEFAULT_EVENT_API_URL,
  TikFinityEventApiAdapter,
  type LiveState,
} from '../../integrations/tikfinity/eventApi/TikFinityEventApiAdapter';
import { clearSession, createSessionSaver, loadSession } from '../persistence';
import { leaderboardRepository } from '../repository';
import { addGift, addLike, createSession, rank, scoreMode, shouldStartNewSession, type LeaderboardSession } from '../store';
import type { PublicLeaderboardConfig } from '../types';
import { sanitizePublicLeaderboard } from '../validate';
import { LeaderboardView } from './LeaderboardView';
import { feedDemo } from './demo';

type Load = { state: 'loading' } | { state: 'ready'; config: PublicLeaderboardConfig } | { state: 'missing'; reason: string };

/**
 * OBS leaderboard overlay: transparent, display-only. Live events come
 * straight from its own TikFinity connection (never through the shared event
 * bus); the session is persisted in this browser so an OBS refresh keeps it.
 * Demo mode (?demo=1) uses an in-memory session that is never saved.
 */
export function LeaderboardOverlayPage({ id, portable, demo, live, setup, diag, eventApiUrl }: OverlayFlags) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [session, setSession] = useState<LeaderboardSession>(() => (demo ? createSession(Date.now()) : loadSession(id, Date.now())));
  const [adapter, setAdapter] = useState<TikFinityEventApiAdapter | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const saver = useRef(createSessionSaver(id));

  useEffect(() => {
    document.documentElement.classList.add('is-overlay');
    return () => document.documentElement.classList.remove('is-overlay');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = portable ? decodeJson(portable, sanitizePublicLeaderboard) : await leaderboardRepository.getPublic(id);
      if (cancelled) return;
      if (config && config.id === id) setLoad({ state: 'ready', config });
      else setLoad({ state: 'missing', reason: portable ? 'Invalid leaderboard link' : 'Leaderboard not found in this browser. Use the portable link from the editor.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, portable]);

  const config = load.state === 'ready' ? load.config : null;
  const gapHours = config?.sessionGapHours ?? 3;

  // Single entry point for every change: new-stream check, update, persist.
  const apply = useCallback(
    (fn: (s: LeaderboardSession, now: number) => LeaderboardSession) => {
      setSession((prev) => {
        const now = Date.now();
        const base = shouldStartNewSession(prev, now, gapHours) ? createSession(now) : prev;
        const next = fn(base, now);
        if (!demo) saver.current.save(next);
        return next;
      });
    },
    [gapHours, demo],
  );

  // A stream that ended long ago should not greet the next one with old names.
  useEffect(() => {
    if (config && !demo) apply((s) => s);
  }, [config, demo, apply]);

  useEffect(() => {
    const s = saver.current;
    const onHide = () => s.flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      s.flush();
    };
  }, []);

  // Live TikFinity connection (not in demo mode, so test and live data never mix).
  const enabled = config?.enabled ?? false;
  const kind = config?.kind;
  useEffect(() => {
    if (!live || demo || !enabled || !kind) return;
    const a = new TikFinityEventApiAdapter({ url: eventApiUrl ?? DEFAULT_EVENT_API_URL });
    const status = createStatusPublisher(id);
    const unsubscribe = a.subscribe((s) => {
      setLiveState(s);
      status.publish(s);
    });
    a.connect(
      (gift) => {
        if (kind === 'gifters' && gift.provider === 'tikfinity' && !gift.isTest) apply((s, now) => addGift(s, gift, now));
      },
      {
        onLike: (like) => {
          if (kind === 'likers' && like.provider === 'tikfinity' && !like.isTest) apply((s, now) => addLike(s, like, now));
        },
      },
    );
    setAdapter(a);
    const heartbeat = setInterval(() => status.publish(a.liveState), STATUS_HEARTBEAT_MS);
    const onHide = () => status.publish({ ...a.liveState, status: 'disconnected', detail: 'Overlay page closed.' });
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onHide);
      unsubscribe();
      a.disconnect();
      status.publish(a.liveState);
      status.close();
      setAdapter(null);
    };
  }, [live, demo, enabled, kind, eventApiUrl, id, apply]);

  // Layout check: clearly-labelled TEST data in memory only.
  useEffect(() => {
    if (!demo || !kind) return;
    const t = setInterval(() => setSession((s) => feedDemo(s, kind, Date.now())), 1500);
    return () => clearInterval(t);
  }, [demo, kind]);

  const reset = () => {
    clearSession(id);
    setSession(createSession(Date.now()));
  };

  if (!config) {
    return load.state === 'missing' ? <div className="overlay-notice">⚠️ {load.reason}</div> : null;
  }

  const mode = scoreMode(session);
  return (
    <>
      {config.enabled ? (
        <LeaderboardView
          title={config.title}
          kind={config.kind}
          rows={rank(session, config.kind, config.topN)}
          mode={mode}
          colors={config.colors}
          topN={config.topN}
          test={demo}
        />
      ) : (
        <div className="overlay-notice">This leaderboard has been disabled by its owner.</div>
      )}
      {setup && (
        <LiveStatusPanel
          live={live && !demo}
          state={liveState}
          adapter={adapter}
          diag={diag}
          extra={
            <div className="lb-setup">
              <p className="hint">
                Session started {new Date(session.startedAt).toLocaleString()} · {Object.keys(session.entries).length} viewers · new session after{' '}
                {gapHours} h without events
              </p>
              {config.kind === 'gifters' && (
                <p className="hint">
                  Ranking by: <b>{mode === 'coins' ? 'coin value (diamondCount × repeatCount)' : 'gift count — a gift arrived without a coin value'}</b>
                </p>
              )}
              {config.kind === 'likers' && <p className="hint">Like totals are approximate: TikTok does not send every like event on busy streams.</p>}
              <button type="button" className="btn btn--danger" onClick={reset}>
                Reset leaderboard now
              </button>
            </div>
          }
        />
      )}
    </>
  );
}
