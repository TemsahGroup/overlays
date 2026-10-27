// TEST events for previews and ?demo=1. Never persisted, always flagged TEST.

import { addGift, addPerson, type SpotlightState } from '../store';

const VIEWERS = ['sara.live', 'omar_99', 'lina.art', 'yousef', 'mona.k', 'karim.dev'];
const GIFTS: [string, number][] = [
  ['Rose', 1],
  ['TikTok', 1],
  ['Finger Heart', 5],
  ['Doughnut', 30],
  ['Corgi', 299],
  ['Lion', 29999],
];
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export function demoGift(s: SpotlightState, now: number, big = false): SpotlightState {
  const [giftName, coins] = big ? GIFTS[GIFTS.length - 1] : pick(GIFTS.slice(0, 4));
  return addGift(s, { name: pick(VIEWERS), giftName, repeatCount: big ? 1 : pick([1, 1, 5, 10]), diamondCount: coins }, now);
}

export function demoPerson(s: SpotlightState, kind: 'follow' | 'share', now: number): SpotlightState {
  return addPerson(s, kind, pick(VIEWERS), now);
}

export function demoStep(s: SpotlightState, now: number): SpotlightState {
  const r = Math.random();
  if (r < 0.6) return demoGift(s, now, r < 0.05);
  return demoPerson(s, r < 0.85 ? 'follow' : 'share', now);
}
