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
import { clearSpotlight, loadSpotlight, saveSpotlight } from '../persistence';
import { spotlightRepository } from '../repository';
import { addGift, addPerson, createSpotlight, shouldStartNew, type SpotlightState } from '../store';
import type { PublicSpotlightConfig } from '../types';
import { sanitizePublicSpotlight } from '../validate';
import { demoStep } from './demo';
import { SpotlightView } from './SpotlightView';

type Load = { state: 'loading' } | { state: 'ready'; config: PublicSpotlightConfig } | { state: 'missing'; reason: string };

/**
 * OBS corner bar: last gift, biggest gift of the stream, last follower and
 * last share, from its own TikFinity connection. Saved in this browser so an
 * OBS refresh keeps it; a long break starts the next stream empty.
 * Demo mode (?demo=1) uses in-memory TEST events that are never saved.
 */
export function SpotlightOverlayPage({ id, portable, demo, live, setup, diag, eventApiUrl, lang }: OverlayFlags) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [state, setState] = useState<SpotlightState>(() => (demo ? createSpotlight(Date.now()) : loadSpotlight(id, Date.now())));
  const [adapter, setAdapter] = useState<TikFinityEventApiAdapter | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    document.documentElement.classList.add('is-overlay');
    return () => document.documentElement.classList.remove('is-overlay');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = portable ? decodeJson(portable, sanitizePublicSpotlight) : await spotlightRepository.getPublic(id);
      if (cancelled) return;
      if (config && config.id === id) setLoad({ state: 'ready', config });
      else setLoad({ state: 'missing', reason: portable ? 'Invalid spotlight link' : 'Spotlight not found in this browser. Use the portable link from the editor.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, portable]);

  const config = load.state === 'ready' ? load.config : null;
  const gapHours = config?.sessionGapHours ?? 3;

  // Single entry point for every change: new-stream check, update, persist.
  const apply = useCallback(
    (fn: (s: SpotlightState, now: number) => SpotlightState) => {
      const now = Date.now();
      const prev = stateRef.current;
      const base = shouldStartNew(prev, now, gapHours) ? createSpotlight(now) : prev;
      const next = fn(base, now);
      stateRef.current = next;
      if (!demo) saveSpotlight(id, next);
      setState(next);
    },
    [gapHours, demo, id],
  );

  // A stream that ended long ago should not greet the next one with old names.
  useEffect(() => {
    if (config && !demo) apply((s) => s);
  }, [config, demo, apply]);

  const enabled = config?.enabled ?? false;
  useEffect(() => {
    if (!live || demo || !enabled) return;
    const a = new TikFinityEventApiAdapter({ url: eventApiUrl ?? DEFAULT_EVENT_API_URL });
    const status = createStatusPublisher(id);
    const unsubscribe = a.subscribe((s) => {
      setLiveState(s);
      status.publish(s);
    });
    const real = (e: { provider: string; isTest: boolean }) => e.provider === 'tikfinity' && !e.isTest;
    a.connect(
      (gift) => {
        if (real(gift)) apply((s, now) => addGift(s, { ...gift, name: gift.nickname || gift.username }, now));
      },
      {
        onSocial: (e) => {
          if (real(e) && e.username) apply((s, now) => addPerson(s, e.type, e.username!, now));
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
  }, [live, demo, enabled, eventApiUrl, id, apply]);

  // Layout check: TEST events in memory only.
  useEffect(() => {
    if (!demo || !config) return;
    const t = setInterval(() => apply((s, now) => demoStep(s, now)), 2500);
    return () => clearInterval(t);
  }, [demo, config, apply]);

  const reset = () => {
    clearSpotlight(id);
    const fresh = createSpotlight(Date.now());
    stateRef.current = fresh;
    setState(fresh);
  };

  if (!config) {
    return load.state === 'missing' ? <div className="overlay-notice">⚠️ {load.reason}</div> : null;
  }

  return (
    <>
      {config.enabled ? (
        <SpotlightView
          state={state}
          items={config.items}
          layout={config.layout}
          rotateSeconds={config.rotateSeconds}
          look={config.style}
          colors={config.colors}
          test={demo}
          lang={lang ?? 'en'}
        />
      ) : (
        <div className="overlay-notice">This spotlight has been disabled by its owner.</div>
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
                Stream started {new Date(state.startedAt).toLocaleString()} · biggest gift by {state.missingValue ? 'gift count (a gift arrived without a coin value)' : 'coin value'} · new stream
                after {gapHours} h without events
              </p>
              <button type="button" className="btn btn--danger" onClick={reset}>
                Reset now
              </button>
            </div>
          }
        />
      )}
    </>
  );
}
