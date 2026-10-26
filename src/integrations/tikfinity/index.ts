// TikFinity integration module — the ONLY place that should know about
// TikFinity. Read ./README.md before changing anything here.
//
// What this module provides today (no network, no invented protocol):
//   • BridgeEventInput        – a simple, documented input format of OUR app
//   • toOverlayEvent()        – validates/normalises BridgeEventInput
//   • dispatchExternalEvent() – sends it into the overlay
//   • readUrlTrigger()        – plays an event described in the page URL
//   • createTikFinityAdapter()– placeholder that refuses to connect until a
//                               documented mechanism is implemented

import { emitOverlayEvent, makeEventId } from '../../events/eventBus';
import type { EventAdapter } from '../../events/adapters/types';
import type { EventSource, OverlayEvent } from '../../events/types';

/**
 * Input format accepted by this overlay. This is our own format, not
 * TikFinity's. Whatever bridge you build must convert into this shape.
 */
export interface BridgeEventInput {
  type: 'gift' | 'follow' | 'like' | 'custom';
  username: string;
  nickname?: string;
  avatarUrl?: string;
  /** gift only, e.g. "Rose" */
  giftName?: string;
  /** gift only, combo count (default 1) */
  repeatCount?: number;
  /** like only (default 1) */
  likeCount?: number;
  /** custom only, e.g. "share", "subscribe" */
  name?: string;
  data?: Record<string, unknown>;
}

export function toOverlayEvent(input: BridgeEventInput, source: EventSource): OverlayEvent | null {
  if (!input || typeof input !== 'object') return null;
  const common = {
    id: makeEventId(),
    timestamp: Date.now(),
    source,
    user: {
      username: String(input.username || 'viewer').slice(0, 64),
      nickname: input.nickname ? String(input.nickname).slice(0, 64) : undefined,
      avatarUrl: input.avatarUrl,
    },
  };
  const positive = (v: unknown, fallback: number) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : fallback;
  };

  switch (input.type) {
    case 'gift':
      return { ...common, type: 'gift', giftName: String(input.giftName || 'Rose'), repeatCount: positive(input.repeatCount, 1) };
    case 'follow':
      return { ...common, type: 'follow' };
    case 'like':
      return { ...common, type: 'like', likeCount: positive(input.likeCount, 1) };
    case 'custom':
      return { ...common, type: 'custom', name: String(input.name || 'custom'), data: input.data };
    default:
      return null;
  }
}

/**
 * Entry point for a real connector. Pass source 'tikfinity' ONLY for events
 * that actually came from TikFinity; local tests must stay 'mock' or 'url'.
 */
export function dispatchExternalEvent(input: BridgeEventInput, source: EventSource = 'mock'): boolean {
  const event = toOverlayEvent(input, source);
  if (event) emitOverlayEvent(event);
  return event !== null;
}

/**
 * Reads a one-shot event from the URL, e.g.
 *   ?overlay=1&trigger=gift&t.user=sara&t.gift=Rose&t.repeat=3
 *   ?overlay=1&trigger=follow&t.user=sara
 *   ?overlay=1&trigger=like&t.user=sara&t.likes=25
 *   ?overlay=1&trigger=custom&t.user=sara&t.name=share
 * Such events are tagged source 'url' (a local test, not a TikTok event).
 */
export function readUrlTrigger(search: string = window.location.search): BridgeEventInput | null {
  const p = new URLSearchParams(search);
  const type = p.get('trigger');
  if (type !== 'gift' && type !== 'follow' && type !== 'like' && type !== 'custom') return null;
  return {
    type,
    username: p.get('t.user') || 'viewer',
    giftName: p.get('t.gift') || undefined,
    repeatCount: Number(p.get('t.repeat')) || undefined,
    likeCount: Number(p.get('t.likes')) || undefined,
    name: p.get('t.name') || undefined,
  };
}

/**
 * Placeholder for a live TikFinity connection. Intentionally not implemented:
 * this project does not assume any undocumented API or WebSocket protocol.
 * See ./README.md for the supported integration paths.
 */
export function createTikFinityAdapter(): EventAdapter {
  return {
    name: 'tikfinity',
    connect() {
      throw new Error(
        'TikFinity adapter is not implemented. Follow src/integrations/tikfinity/README.md ' +
          'and implement it only against TikFinity’s official documentation.',
      );
    },
    disconnect() {},
  };
}
