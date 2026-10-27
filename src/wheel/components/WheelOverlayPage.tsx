import { useEffect, useState } from 'react';
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
import { wheelRepository } from '../repository';
import { spinsFor } from '../spin';
import type { PublicWheelConfig } from '../types';
import { sanitizePublicWheel } from '../validate';
import { useWheelSpinner } from './useWheelSpinner';
import { WheelView } from './WheelView';

type Load = { state: 'loading' } | { state: 'ready'; config: PublicWheelConfig } | { state: 'missing'; reason: string };

const DEMO_VIEWERS = ['sara.live', 'omar_99', 'lina.art', 'yousef', 'mona.k'];

/**
 * OBS wheel of fortune: transparent, display-only. The trigger gift (or any
 * gift worth enough coins) from its own TikFinity connection queues spins.
 * Demo mode (?demo=1) spins for TEST viewers; ?setup=1 adds a manual spin.
 */
export function WheelOverlayPage({ id, portable, demo, live, setup, diag, eventApiUrl, lang }: OverlayFlags) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [adapter, setAdapter] = useState<TikFinityEventApiAdapter | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('is-overlay');
    return () => document.documentElement.classList.remove('is-overlay');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = portable ? decodeJson(portable, sanitizePublicWheel) : await wheelRepository.getPublic(id);
      if (cancelled) return;
      if (config && config.id === id) setLoad({ state: 'ready', config });
      else setLoad({ state: 'missing', reason: portable ? 'Invalid wheel link' : 'Wheel not found in this browser. Use the portable link from the editor.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, portable]);

  const config = load.state === 'ready' ? load.config : null;
  const spinner = useWheelSpinner(config?.segments.length ?? 0, config?.spinSeconds ?? 5);
  const { enqueue } = spinner;

  // Live TikFinity connection (not in demo mode, so test and live spins never mix).
  const enabled = config?.enabled ?? false;
  const trigger = config ? JSON.stringify([config.trigger, config.giftName, config.minCoins, config.spinEach]) : '';
  useEffect(() => {
    if (!live || demo || !enabled || !trigger) return;
    const [mode, giftName, minCoins, spinEach] = JSON.parse(trigger) as [PublicWheelConfig['trigger'], string, number, boolean];
    const a = new TikFinityEventApiAdapter({ url: eventApiUrl ?? DEFAULT_EVENT_API_URL });
    const status = createStatusPublisher(id);
    const unsubscribe = a.subscribe((s) => {
      setLiveState(s);
      status.publish(s);
    });
    a.connect((gift) => {
      if (gift.provider !== 'tikfinity' || gift.isTest) return;
      const n = spinsFor({ trigger: mode, giftName, minCoins, spinEach }, gift);
      if (n > 0) enqueue(gift.nickname || gift.username, n);
    });
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
  }, [live, demo, enabled, trigger, eventApiUrl, id, enqueue]);

  // Layout check: a TEST spin every few seconds.
  useEffect(() => {
    if (!demo || !config) return;
    const first = setTimeout(() => enqueue(DEMO_VIEWERS[0]), 800);
    const t = setInterval(() => enqueue(DEMO_VIEWERS[Math.floor(Math.random() * DEMO_VIEWERS.length)]), (config.spinSeconds + 6) * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [demo, config, enqueue]);

  if (!config) {
    return load.state === 'missing' ? <div className="overlay-notice">⚠️ {load.reason}</div> : null;
  }

  return (
    <>
      {config.enabled ? (
        <WheelView
          title={config.title}
          segments={config.segments}
          look={config.style}
          rotation={spinner.rotation}
          spinning={spinner.spinning}
          spinSeconds={config.spinSeconds}
          result={spinner.result}
          queued={spinner.queued}
          hubIcon={config.trigger === 'gift' ? giftIcon(config.giftName) : '🪙'}
          visible={!config.hideWhenIdle || spinner.busy || setup}
          test={demo}
          lang={lang ?? 'en'}
        />
      ) : (
        <div className="overlay-notice">This wheel has been disabled by its owner.</div>
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
                Spins on: {config.trigger === 'gift' ? `"${config.giftName}" (${config.spinEach ? 'one spin per gift' : 'one spin per streak'})` : `any gift worth ≥ ${config.minCoins} coins`} ·
                waiting: {spinner.queued}
              </p>
              <div className="row">
                <button type="button" className="btn" onClick={() => enqueue(null)}>
                  🎡 Spin now (manual)
                </button>
                <button type="button" className="btn" onClick={spinner.clear}>
                  Clear waiting spins
                </button>
              </div>
            </div>
          }
        />
      )}
    </>
  );
}
