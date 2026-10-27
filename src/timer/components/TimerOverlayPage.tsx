import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveStatusPanel } from '../../builder/components/LiveStatusPanel';
import { giftIcon } from '../../builder/gifts';
import { decodeJson } from '../../builder/repository/portable';
import type { OverlayFlags } from '../../builder/route';
import { createStatusPublisher, STATUS_HEARTBEAT_MS } from '../../integrations/tikfinity/eventApi/statusChannel';
import {
  DEFAULT_EVENT_API_URL,
  TikFinityEventApiAdapter,
  type LiveState,
} from '../../integrations/tikfinity/eventApi/TikFinityEventApiAdapter';
import { clearTimer, loadTimer, saveTimer } from '../persistence';
import { timerRepository } from '../repository';
import { addTime, createTimer, formatTime, giftSeconds, likeSeconds, pause, resume, shouldStartNew, timeLeft, type TimerState } from '../store';
import type { PublicTimerConfig } from '../types';
import { sanitizePublicTimer } from '../validate';
import { TimerView, type TimerAdd } from './TimerView';

type Load = { state: 'loading' } | { state: 'ready'; config: PublicTimerConfig } | { state: 'missing'; reason: string };

const DEMO_VIEWERS = ['sara.live', 'omar_99', 'lina.art', 'yousef', 'mona.k'];
const MAX_ADDS = 5;

/**
 * OBS gift timer: a countdown that live gifts, follows, shares and likes
 * extend. The countdown is saved in this browser (an OBS refresh keeps the
 * exact time); ?setup=1 adds Start/Pause, ±1 min and Reset.
 * Demo mode (?demo=1) runs an in-memory TEST timer that is never saved.
 */
export function TimerOverlayPage({ id, portable, demo, live, setup, diag, eventApiUrl, lang }: OverlayFlags) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [adds, setAdds] = useState<TimerAdd[]>([]);
  const [adapter, setAdapter] = useState<TikFinityEventApiAdapter | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const likeCarry = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add('is-overlay');
    return () => document.documentElement.classList.remove('is-overlay');
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = portable ? decodeJson(portable, sanitizePublicTimer) : await timerRepository.getPublic(id);
      if (cancelled) return;
      if (config && config.id === id) setLoad({ state: 'ready', config });
      else setLoad({ state: 'missing', reason: portable ? 'Invalid timer link' : 'Timer not found in this browser. Use the portable link from the editor.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, portable]);

  const config = load.state === 'ready' ? load.config : null;
  const startMs = (config?.startMinutes ?? 60) * 60_000;
  const capMs = (config?.maxHours ?? 0) * 3_600_000;
  const autoStart = config?.autoStart ?? true;
  const gapHours = config?.sessionGapHours ?? 3;

  // The latest state lives in a ref too, so a change knows right away whether it did anything.
  const timerRef = useRef<TimerState | null>(null);
  const commit = useCallback(
    (next: TimerState) => {
      timerRef.current = next;
      if (!demo) saveTimer(id, next);
      setTimer(next);
    },
    [demo, id],
  );

  const apply = useCallback(
    (fn: (s: TimerState, at: number) => TimerState): boolean => {
      const prev = timerRef.current;
      if (!prev) return false;
      const next = fn(prev, Date.now());
      if (next === prev) return false;
      commit(next);
      return true;
    },
    [commit],
  );

  const add = useCallback(
    (seconds: number, name: string | null, icon: string, byViewer = true) => {
      // The popup only shows when time was really added (not after the end or at the cap).
      if (seconds && apply((s, at) => addTime(s, seconds * 1000, at, capMs, byViewer))) {
        setAdds((list) => [...list, { id: Date.now() + Math.random(), seconds, name, icon }].slice(-MAX_ADDS));
      }
    },
    [apply, capMs],
  );

  // Restore this stream's countdown, or start a fresh one for a new stream.
  useEffect(() => {
    if (!config) return;
    const at = Date.now();
    const stored = demo ? null : loadTimer(id);
    commit(stored && !shouldStartNew(stored, at, gapHours) ? stored : createTimer(startMs, at, autoStart));
  }, [config, demo, id, gapHours, startMs, autoStart, commit]);

  // Live TikFinity connection (not in demo mode, so test and live data never mix).
  const enabled = config?.enabled ?? false;
  const rules = config ? JSON.stringify(config.rules) : '';
  const showAdds = config?.showAdds ?? true;
  useEffect(() => {
    if (!live || demo || !enabled || !rules) return;
    const r = JSON.parse(rules) as PublicTimerConfig['rules'];
    const a = new TikFinityEventApiAdapter({ url: eventApiUrl ?? DEFAULT_EVENT_API_URL });
    const status = createStatusPublisher(id);
    const unsubscribe = a.subscribe((s) => {
      setLiveState(s);
      status.publish(s);
    });
    const real = (e: { provider: string; isTest: boolean }) => e.provider === 'tikfinity' && !e.isTest;
    const who = (e: { nickname?: string; username?: string }) => (showAdds ? e.nickname || e.username || null : null);
    a.connect(
      (gift) => {
        if (real(gift) && r.perCoin) add(giftSeconds(r, gift), who(gift), giftIcon(gift.giftName));
      },
      {
        onLike: (like) => {
          if (!real(like) || !r.per100Likes) return;
          const { seconds, carry } = likeSeconds(r, likeCarry.current, like.likeCount);
          likeCarry.current = carry;
          if (seconds) add(seconds, null, '❤️');
        },
        onSocial: (e) => {
          if (!real(e)) return;
          const seconds = e.type === 'follow' ? r.perFollow : r.perShare;
          if (seconds) add(seconds, who(e), e.type === 'follow' ? '👥' : '🔁');
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
  }, [live, demo, enabled, rules, showAdds, eventApiUrl, id, add]);

  // Layout check: TEST additions every few seconds, in memory only.
  useEffect(() => {
    if (!demo || !config) return;
    const t = setInterval(() => {
      const name = DEMO_VIEWERS[Math.floor(Math.random() * DEMO_VIEWERS.length)];
      if (Math.random() < 0.7) add(giftSeconds(config.rules, { repeatCount: 1, diamondCount: [1, 1, 5, 10][Math.floor(Math.random() * 4)] }), name, '🌹');
      else add(config.rules.perFollow, name, '👥');
    }, 2500);
    return () => clearInterval(t);
  }, [demo, config, add]);

  // Drop popups once their animation is over.
  useEffect(() => {
    if (!adds.length) return;
    const t = setTimeout(() => setAdds((list) => list.slice(1)), 2700);
    return () => clearTimeout(t);
  }, [adds]);

  const reset = () => {
    if (!demo) clearTimer(id);
    likeCarry.current = 0;
    commit(createTimer(startMs, Date.now(), false));
  };

  if (!config || !timer) {
    return load.state === 'missing' ? <div className="overlay-notice">⚠️ {load.reason}</div> : null;
  }

  const left = timeLeft(timer, now);
  return (
    <>
      {config.enabled ? (
        <TimerView
          title={config.title}
          leftMs={left}
          running={timer.running}
          look={config.style}
          colors={config.colors}
          rules={config.rules}
          showRules={config.showRules}
          adds={config.showAdds ? adds : []}
          test={demo}
          lang={lang ?? 'en'}
        />
      ) : (
        <div className="overlay-notice">This timer has been disabled by its owner.</div>
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
                {timer.running ? 'Running' : 'Paused'} · {formatTime(left)} left · viewers added {formatTime(timer.addedMs)}
                {config.maxHours ? ` · limit ${config.maxHours} h` : ''}
              </p>
              <div className="row">
                <button type="button" className="btn primary" onClick={() => apply((s, at) => (s.running ? pause(s, at) : resume(s, at)))}>
                  {timer.running ? '⏸ Pause' : '▶ Start'}
                </button>
                <button type="button" className="btn" onClick={() => add(60, null, '⏱️', false)}>
                  +1 min
                </button>
                <button type="button" className="btn" onClick={() => add(-60, null, '⏱️', false)}>
                  −1 min
                </button>
                <button type="button" className="btn btn--danger" onClick={reset}>
                  Reset
                </button>
              </div>
              <p className="hint">Reset sets the timer back to {config.startMinutes} min and pauses it — press Start when the stream begins.</p>
            </div>
          }
        />
      )}
    </>
  );
}
