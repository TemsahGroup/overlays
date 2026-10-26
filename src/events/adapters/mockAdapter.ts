// Local mock adapter. Every event it creates has source: 'mock' and is shown
// as a TEST event in the dashboard log and on alert cards. Nothing here talks
// to TikTok or TikFinity.

import { emitOverlayEvent, makeEventId } from '../eventBus';
import type { CustomEvent, FollowEvent, GiftEvent, LikeEvent } from '../types';
import type { EventAdapter } from './types';

const DEMO_USERS = ['sara.live', 'omar_99', 'lina.art', 'yousef', 'mona.k', 'karim.dev', 'nour', 'ziad.fm'];
const DEMO_CUSTOM = ['share', 'subscribe', 'chat:!party'];

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const base = (username: string) => ({
  id: makeEventId(),
  timestamp: Date.now(),
  source: 'mock' as const,
  user: { username: username.trim() || 'test_viewer' },
});

export const mock = {
  gift(username: string, giftName = 'Rose', repeatCount = 1): GiftEvent {
    const event: GiftEvent = { ...base(username), type: 'gift', giftName, repeatCount: Math.max(1, repeatCount) };
    emitOverlayEvent(event);
    return event;
  },
  follow(username: string): FollowEvent {
    const event: FollowEvent = { ...base(username), type: 'follow' };
    emitOverlayEvent(event);
    return event;
  },
  like(username: string, likeCount = 15): LikeEvent {
    const event: LikeEvent = { ...base(username), type: 'like', likeCount: Math.max(1, likeCount) };
    emitOverlayEvent(event);
    return event;
  },
  custom(username: string, name: string, data?: Record<string, unknown>): CustomEvent {
    const event: CustomEvent = { ...base(username), type: 'custom', name, data };
    emitOverlayEvent(event);
    return event;
  },
};

/** Emits a random mock event every `intervalMs`. Useful for checking a layout in OBS. */
export function createMockAdapter(intervalMs = 2600): EventAdapter {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    name: 'mock',
    connect() {
      if (timer) return;
      timer = setInterval(() => {
        const user = pick(DEMO_USERS);
        const roll = Math.random();
        if (roll < 0.3) mock.gift(user, 'Rose', 1 + Math.floor(Math.random() * 3));
        else if (roll < 0.5) mock.follow(user);
        else if (roll < 0.85) mock.like(user, 5 + Math.floor(Math.random() * 40));
        else mock.custom(user, pick(DEMO_CUSTOM));
      }, intervalMs);
    },
    disconnect() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
