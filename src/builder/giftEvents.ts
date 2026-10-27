// Provider-independent gift events for the builder.
//
//   provider (mock today, TikFinity bridge later)
//        │  NormalizedGiftEvent
//        ▼
//   normalizeGift() → existing eventBus (OverlayEvent, type 'gift')
//        ▼
//   BuilderOverlay: matchMapping() → effect for that configuration
//
// A web page cannot subscribe to TikTok gifts by itself. The live provider is
// the TikFinity Event API (local WebSocket, TikFinity Desktop on the SAME
// computer), implemented in src/integrations/tikfinity/eventApi/ and started
// only by the OBS overlay route.

import { emitOverlayEvent, makeEventId } from '../events/eventBus';
import type { GiftEvent, OverlayEvent } from '../events/types';
import type { GiftMapping, PublicOverlayConfig } from './types';

export interface NormalizedGiftEvent {
  type: 'gift';
  giftId?: string;
  giftName: string;
  username: string;
  nickname?: string;
  repeatCount: number;
  /** Provider event id, used to drop duplicates. */
  eventId?: string;
  /** true for anything that is not a real live event. */
  isTest: boolean;
  provider: 'mock' | 'tikfinity';
  /** Coin value of one gift when the provider sends it (TikFinity v1 `diamondCount`). */
  diamondCount?: number;
}

/** A batch of likes from one viewer (used by leaderboards, not by gift effects). */
export interface NormalizedLikeEvent {
  type: 'like';
  username: string;
  nickname?: string;
  likeCount: number;
  eventId?: string;
  isTest: boolean;
  provider: 'mock' | 'tikfinity';
}

/** One viewer chat message (chat overlay). */
export interface NormalizedChatEvent {
  type: 'chat';
  username: string;
  nickname?: string;
  comment: string;
  /** https profile picture when the provider sends one. */
  avatarUrl?: string;
  isModerator?: boolean;
  isSubscriber?: boolean;
  eventId?: string;
  isTest: boolean;
  provider: 'mock' | 'tikfinity';
}

export type ConnectionState =
  | { status: 'mock'; detail: string }
  | { status: 'disconnected'; detail: string }
  | { status: 'not-configured'; detail: string }
  | { status: 'connecting' | 'connected'; detail: string }
  | { status: 'error'; detail: string };

export interface GiftEventAdapter {
  readonly name: string;
  readonly state: ConnectionState;
  connect(onEvent: (event: NormalizedGiftEvent) => void): void;
  disconnect(): void;
}

/** Remembers recent event ids so the same gift is not played twice. */
export class Deduper {
  private seen = new Map<string, number>();
  constructor(private ttlMs = 60_000, private max = 500) {}

  isDuplicate(id: string | undefined, now = Date.now()): boolean {
    if (!id) return false;
    for (const [key, t] of this.seen) {
      if (now - t > this.ttlMs || this.seen.size > this.max) this.seen.delete(key);
      else break; // Map keeps insertion order: the rest are newer
    }
    if (this.seen.has(id)) return true;
    this.seen.set(id, now);
    return false;
  }
}

/** Converts a normalized gift into the app's existing OverlayEvent. */
export function normalizeGift(e: NormalizedGiftEvent): GiftEvent {
  // Only a real provider may produce a live (non-test) event.
  const live = !e.isTest && e.provider === 'tikfinity';
  return {
    id: e.eventId ? `${e.provider}:${e.eventId}` : makeEventId(),
    timestamp: Date.now(),
    source: live ? 'tikfinity' : 'mock',
    user: { username: e.username || 'viewer', nickname: e.nickname },
    type: 'gift',
    giftId: e.giftId,
    giftName: e.giftName,
    repeatCount: Math.max(1, Math.min(9999, Math.floor(e.repeatCount) || 1)),
  };
}

const dedupe = new Deduper();

/** Entry point for any GiftEventAdapter: dedupe, normalize, dispatch. */
export function dispatchGift(e: NormalizedGiftEvent): boolean {
  if (dedupe.isDuplicate(e.eventId ? `${e.provider}:${e.eventId}` : undefined)) return false;
  emitOverlayEvent(normalizeGift(e));
  return true;
}

/** Sends a clearly-labelled TEST gift (used by the builder's Test button). */
export function sendTestGift(giftName: string, username = 'test_viewer', repeatCount = 1, giftId?: string): void {
  dispatchGift({ type: 'gift', giftName, giftId, username, repeatCount, isTest: true, provider: 'mock' });
}

/** Case- and whitespace-insensitive gift name used for matching. */
export function normalizeGiftName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Finds the mapping of a configuration that this event should trigger:
 * by gift id when both the mapping and the event have one, otherwise by name.
 */
export function matchMapping(config: PublicOverlayConfig, event: OverlayEvent): GiftMapping | null {
  if (event.type !== 'gift') return null;
  return (
    config.mappings.find((m) =>
      m.selectedGiftId && event.giftId
        ? m.selectedGiftId === String(event.giftId)
        : normalizeGiftName(m.selectedGiftName) === normalizeGiftName(event.giftName),
    ) ?? null
  );
}
