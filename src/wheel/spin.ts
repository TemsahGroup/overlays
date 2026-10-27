// Wheel maths and triggers — pure functions, unit-tested.
//
// Angles are degrees, clockwise, 0 = the pointer at the top. Segment i covers
// [i·w, (i+1)·w) of the wheel with w = 360 / count. Rotating the wheel by R
// puts the wheel angle (−R mod 360) under the pointer.

import { normalizeGiftName } from '../builder/giftEvents';
import type { PublicWheelConfig } from './types';

export const MAX_QUEUE = 20;

/** Every segment has the same chance. */
export function pickSegment(count: number, rand: () => number = Math.random): number {
  return Math.min(count - 1, Math.floor(rand() * count));
}

/** Segment under the pointer for a given rotation. */
export function segmentAt(rotation: number, count: number): number {
  const w = 360 / count;
  const angle = (((-rotation % 360) + 360) % 360);
  return Math.floor(angle / w) % count;
}

/**
 * Rotation that lands segment `index` under the pointer after `turns` full
 * turns, always moving forward from `current`, at a random spot that keeps
 * clear of the segment edges.
 */
export function spinTarget(current: number, index: number, count: number, turns = 6, rand: () => number = Math.random): number {
  const w = 360 / count;
  const spot = index * w + w * (0.15 + 0.7 * rand());
  const finalMod = (360 - spot) % 360;
  const base = current + turns * 360;
  const baseMod = ((base % 360) + 360) % 360;
  return base + ((finalMod - baseMod + 360) % 360);
}

export interface GiftLike {
  giftId?: string;
  giftName: string;
  repeatCount: number;
  diamondCount?: number;
}

/** How many spins a final gift message earns (0 when it does not trigger the wheel). */
export function spinsFor(config: Pick<PublicWheelConfig, 'trigger' | 'giftName' | 'minCoins' | 'spinEach'>, gift: GiftLike): number {
  const count = Math.max(1, Math.floor(gift.repeatCount) || 1);
  if (config.trigger === 'gift') {
    if (normalizeGiftName(gift.giftName) !== normalizeGiftName(config.giftName)) return 0;
    return config.spinEach ? count : 1;
  }
  // Coins: the whole streak's value must reach the minimum; unknown value never triggers.
  if (gift.diamondCount === undefined || !Number.isFinite(gift.diamondCount)) return 0;
  return gift.diamondCount * count >= config.minCoins ? 1 : 0;
}
