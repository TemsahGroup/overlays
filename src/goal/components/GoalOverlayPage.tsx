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
import { clearProgress, createProgressSaver, loadProgress } from '../persistence';
import { goalRepository } from '../repository';
import { addAmount, addGift, createProgress, progressValue, shouldStartNew, type GoalProgress } from '../store';
import type { PublicGoalConfig } from '../types';
import { sanitizePublicGoal } from '../validate';
import { demoStep } from './demo';
import { GoalView } from './GoalView';

type Load = { state: 'loading' } | { state: 'ready'; config: PublicGoalConfig } | { state: 'missing'; reason: string };

/**
 * OBS goal bar: transparent, display-only. Live events come from its own
 * TikFinity connection; progress is saved in this browser so an OBS refresh
 * keeps it, and a long break starts the next stream from zero.
 * Demo mode (?demo=1) uses in-memory TEST progress that is never saved.
 */
export function GoalOverlayPage({ id, portable, demo, live, setup, diag, eventApiUrl, lang }: OverlayFlags) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [progress, setProgress] = useState<GoalProgress>(() => (demo ? createProgress(Date.now()) : loadProgress(id, Date.now())));
  const [adapter, setAdapter] = useState<TikFinityEventApiAdapter | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const saver = useRef(createProgressSaver(id));

  useEffect(() => {
    document.documentElement.classList.add('is-overlay');
    return () => document.documentElement.classList.remove('is-overlay');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = portable ? decodeJson(portable, sanitizePublicGoal) : await goalRepository.getPublic(id);
      if (cancelled) return;
      if (config && config.id === id) setLoad({ state: 'ready', config });
      else setLoad({ state: 'missing', reason: portable ? 'Invalid goal link' : 'Goal not found in this browser. Use the portable link from the editor.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, portable]);

  const config = load.state === 'ready' ? load.config : null;
  const gapHours = config?.sessionGapHours ?? 3;

  // Single entry point for every change: new-stream check, update, persist.
  const apply = useCallback(
    (fn: (p: GoalProgress, now: number) => GoalProgress) => {
      setProgress((prev) => {
        const now = Date.now();
        const base = shouldStartNew(prev, now, gapHours) ? createProgress(now) : prev;
        const next = fn(base, now);
        if (!demo) saver.current.save(next);
        return next;
      });
    },
    [gapHours, demo],
  );

  useEffect(() => {
    if (config && !demo) apply((p) => p);
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
  const metric = config?.metric;
  useEffect(() => {
    if (!live || demo || !enabled || !metric) return;
    const a = new TikFinityEventApiAdapter({ url: eventApiUrl ?? DEFAULT_EVENT_API_URL });
    const status = createStatusPublisher(id);
    const unsubscribe = a.subscribe((s) => {
      setLiveState(s);
      status.publish(s);
    });
    const real = (e: { provider: string; isTest: boolean }) => e.provider === 'tikfinity' && !e.isTest;
    a.connect(
      (gift) => {
        if (metric === 'coins' && real(gift)) apply((p, now) => addGift(p, gift, now));
      },
      {
        onLike: (like) => {
          if (metric === 'likes' && real(like)) apply((p, now) => addAmount(p, like.likeCount, now));
        },
        onSocial: (e) => {
          if (real(e) && ((metric === 'follows' && e.type === 'follow') || (metric === 'shares' && e.type === 'share'))) apply((p, now) => addAmount(p, 1, now));
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
  }, [live, demo, enabled, metric, eventApiUrl, id, apply]);

  // Layout check: clearly-labelled TEST progress in memory only.
  const target = config?.target ?? 1;
  useEffect(() => {
    if (!demo || !metric) return;
    const t = setInterval(() => setProgress((p) => demoStep(p, metric, target, Date.now())), 1500);
    return () => clearInterval(t);
  }, [demo, metric, target]);

  const reset = () => {
    clearProgress(id);
    setProgress(createProgress(Date.now()));
  };

  if (!config) {
    return load.state === 'missing' ? <div className="overlay-notice">⚠️ {load.reason}</div> : null;
  }

  const coins = config.metric === 'coins';
  return (
    <>
      {config.enabled ? (
        <GoalView
          title={config.title}
          metric={config.metric}
          mode={progress.missingValue ? 'count' : 'coins'}
          value={progressValue(progress, coins)}
          target={config.target}
          autoNext={config.autoNext}
          look={config.style}
          colors={config.colors}
          test={demo}
          lang={lang ?? 'en'}
        />
      ) : (
        <div className="overlay-notice">This goal has been disabled by its owner.</div>
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
                Stream started {new Date(progress.startedAt).toLocaleString()} · counting {config.metric}
                {coins && (progress.missingValue ? ' (gift count — a gift arrived without a coin value)' : ' (coin value)')} · new stream after {gapHours} h without
                events
              </p>
              {config.metric === 'likes' && <p className="hint">Like totals are approximate: TikTok does not send every like event on busy streams.</p>}
              <button type="button" className="btn btn--danger" onClick={reset}>
                Reset goal now
              </button>
            </div>
          }
        />
      )}
    </>
  );
}
