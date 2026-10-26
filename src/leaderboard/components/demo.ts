// TEST data for previews and ?demo=1. Never persisted, always shown with a
// TEST DATA chip. Coin values here are made up for layout checks only.

import { addGift, addLike, type LeaderboardSession } from '../store';
import type { LeaderboardKind } from '../types';

const VIEWERS = ['sara.live', 'omar_99', 'lina.art', 'yousef', 'mona.k', 'karim.dev', 'nour', 'ziad.fm', 'hana', 'adam'];
const TEST_GIFTS = [1, 1, 1, 5, 10, 99];

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export function feedDemo(session: LeaderboardSession, kind: LeaderboardKind, now: number): LeaderboardSession {
  const username = pick(VIEWERS);
  return kind === 'likers'
    ? addLike(session, { username, likeCount: 5 + Math.floor(Math.random() * 40) }, now)
    : addGift(session, { username, repeatCount: 1 + Math.floor(Math.random() * 3), diamondCount: pick(TEST_GIFTS) }, now);
}

export function testGift(session: LeaderboardSession, username: string, diamondCount: number, now: number): LeaderboardSession {
  return addGift(session, { username, repeatCount: 1, diamondCount }, now);
}

export function testLikes(session: LeaderboardSession, username: string, likeCount: number, now: number): LeaderboardSession {
  return addLike(session, { username, likeCount }, now);
}

export { VIEWERS as DEMO_VIEWERS };
