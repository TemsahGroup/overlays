// Read-only status sharing: an overlay tab publishes its live connection state
// so the builder (same browser) can display it. The builder never opens a
// connection itself. OBS is a separate browser, so its status is only visible
// in the overlay's own setup view (?setup=1).

import type { LiveState } from './TikFinityEventApiAdapter';

const CHANNEL = 'tikfinity-live-status';
/** Overlays re-publish this often; older reports are treated as stale. */
export const STATUS_HEARTBEAT_MS = 5000;
export const STATUS_STALE_MS = 12_000;

export interface StatusMessage {
  configId: string;
  state: LiveState;
}

export function createStatusPublisher(configId: string): { publish(state: LiveState): void; close(): void } {
  if (typeof BroadcastChannel === 'undefined') return { publish() {}, close() {} };
  const ch = new BroadcastChannel(CHANNEL);
  return {
    publish: (state) => ch.postMessage({ configId, state } satisfies StatusMessage),
    close: () => ch.close(),
  };
}

export function subscribeStatus(fn: (msg: StatusMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e: MessageEvent<StatusMessage>) => {
    if (e.data && typeof e.data.configId === 'string' && e.data.state) fn(e.data);
  };
  return () => ch.close();
}
