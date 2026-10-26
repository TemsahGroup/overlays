import { emitOverlayEvent, onOverlayEvent } from './eventBus';
import type { OverlayEvent } from './types';

/**
 * Mirrors events between tabs of the same browser (BroadcastChannel), so a
 * button in the dashboard tab also plays in an overlay tab.
 *
 * It does NOT reach OBS or TikTok LIVE Studio: those run their own browser
 * engine in a separate process.
 *
 * Live TikFinity events are never relayed: every live overlay has its own
 * connection, so forwarding them would play the same gift twice (and leak
 * live gifts into the original LIVE Overlay Effects pages).
 */
export function startTabRelay(channelName = 'tiktok-overlay-events'): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(channelName);

  const unsubscribe = onOverlayEvent((event) => {
    if (!event.relayed && event.source !== 'tikfinity') channel.postMessage(event);
  });
  channel.onmessage = (e: MessageEvent<OverlayEvent>) => {
    if (e.data && typeof e.data === 'object' && 'type' in e.data && e.data.source !== 'tikfinity') {
      emitOverlayEvent({ ...e.data, relayed: true });
    }
  };

  return () => {
    unsubscribe();
    channel.close();
  };
}
