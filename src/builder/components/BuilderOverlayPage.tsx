import { useEffect, useMemo, useState } from 'react';
import { OverlayStage } from '../../components/OverlayStage';
import { DEFAULT_SNOW } from '../../config/settings';
import { DEFAULT_SETTINGS } from '../../effects/settings';
import { dispatchGift, sendTestGift } from '../giftEvents';
import { createStatusPublisher, STATUS_HEARTBEAT_MS } from '../../integrations/tikfinity/eventApi/statusChannel';
import {
  DEFAULT_EVENT_API_URL,
  TikFinityEventApiAdapter,
  type LiveState,
} from '../../integrations/tikfinity/eventApi/TikFinityEventApiAdapter';
import { LiveStatusPanel } from './LiveStatusPanel';
import { resolveConfigPlay } from '../play';
import { decodePortable } from '../repository/portable';
import { repository } from '../repository/localRepository';
import type { PublicOverlayConfig } from '../types';

type Load =
  | { state: 'loading' }
  | { state: 'ready'; config: PublicOverlayConfig }
  | { state: 'missing'; reason: string };

interface Props {
  id: string;
  portable: string | null;
  demo: boolean;
  /** Connect to TikFinity Desktop (default true; ?live=0 disables). */
  live: boolean;
  /** Show the connection status panel (?setup=1). */
  setup: boolean;
  /** Show payload diagnostics (?diag=1, dev builds only). */
  diag: boolean;
  eventApiUrl: string | null;
}

/** Display-only overlay for OBS: transparent, no builder controls. */
export function BuilderOverlayPage({ id, portable, demo, live, setup, diag, eventApiUrl }: Props) {
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
      if (portable) {
        const config = decodePortable(portable);
        if (!cancelled) {
          setLoad(config && config.id === id ? { state: 'ready', config } : { state: 'missing', reason: 'Invalid overlay link' });
        }
        return;
      }
      const config = await repository.getPublic(id);
      if (!cancelled) {
        setLoad(
          config
            ? { state: 'ready', config }
            : { state: 'missing', reason: 'Configuration not found in this browser. Use the portable overlay link from the builder.' },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, portable]);

  const config = load.state === 'ready' ? load.config : null;
  const resolvePlay = useMemo(() => resolveConfigPlay(config), [config]);

  // Live TikFinity connection: only on this OBS route, only for a loaded,
  // enabled configuration. Real gifts go through the same dispatchGift() path
  // as test gifts, but arrive as provider 'tikfinity' / isTest false.
  const enabled = config?.enabled ?? false;
  useEffect(() => {
    if (!live || !enabled) return;
    const a = new TikFinityEventApiAdapter({ url: eventApiUrl ?? DEFAULT_EVENT_API_URL });
    const status = createStatusPublisher(id);
    const unsubscribe = a.subscribe((s) => {
      setLiveState(s);
      status.publish(s);
    });
    a.connect((event) => dispatchGift(event));
    setAdapter(a);
    // Heartbeat + tab-close notice so the builder never shows a stale "Connected".
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
  }, [live, enabled, eventApiUrl, id]);

  // Layout check for OBS: a clearly-labelled TEST gift every few seconds.
  useEffect(() => {
    if (!demo || !config?.enabled) return;
    const gift = config.mappings[0];
    const t = setInterval(() => sendTestGift(gift.selectedGiftName, 'demo_viewer', 1, gift.selectedGiftId ?? undefined), 6000);
    return () => clearInterval(t);
  }, [demo, config]);

  return (
    <>
      <OverlayStage
        effects={[]}
        settings={DEFAULT_SETTINGS}
        snow={false}
        snowSettings={DEFAULT_SNOW}
        testBadge
        resolvePlay={resolvePlay}
      />
      {/* Setup diagnostics only; a working overlay renders nothing but effects. */}
      {load.state === 'missing' && <div className="overlay-notice">⚠️ {load.reason}</div>}
      {config && !config.enabled && <div className="overlay-notice">This overlay has been disabled by its owner.</div>}
      {setup && <LiveStatusPanel live={live} state={liveState} adapter={adapter} diag={diag} />}
    </>
  );
}
