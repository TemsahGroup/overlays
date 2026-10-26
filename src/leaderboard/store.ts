// Leaderboard scoring — pure functions, no React, no storage.
//
// Gifters are ranked by coin value (diamondCount × repeatCount) as long as
// every gift in the session carried a value. If any gift arrived without one,
// the whole board switches to counting gifts, so coins and counts are never
// mixed in one ranking. Likers are ranked by the sum of likeCount.

import type { LeaderboardKind } from './types';

export const SESSION_VERSION = 1;
const MAX_ENTRIES = 5000;
const KEEP_AFTER_PRUNE = 2000;

export type ScoreMode = 'coins' | 'count';

export interface LeaderEntry {
  name: string;
  coins: number;
  gifts: number;
  likes: number;
  /** When this entry's score last changed — earlier wins ties. */
  updatedAt: number;
}

export interface LeaderboardSession {
  version: number;
  startedAt: number;
  /** 0 = no event yet in this session. */
  lastEventAt: number;
  /** true once any gift arrived without a coin value → rank by count. */
  missingValue: boolean;
  entries: Record<string, LeaderEntry>;
}

export interface GiftInput {
  username: string;
  nickname?: string;
  repeatCount: number;
  diamondCount?: number;
}

export interface LikeInput {
  username: string;
  nickname?: string;
  likeCount: number;
}

export interface RankedRow {
  rank: number;
  key: string;
  name: string;
  score: number;
}

export function createSession(now: number): LeaderboardSession {
  return { version: SESSION_VERSION, startedAt: now, lastEventAt: 0, missingValue: false, entries: {} };
}

const userKey = (username: string) => username.trim().toLowerCase();
const displayName = (username: string, nickname?: string) => (nickname?.trim() || username.trim()).slice(0, 40);
const positive = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

function upsert(session: LeaderboardSession, username: string, nickname: string | undefined, now: number, patch: (e: LeaderEntry) => LeaderEntry): LeaderboardSession {
  const key = userKey(username);
  if (!key) return session;
  const prev = session.entries[key] ?? { name: displayName(username, nickname), coins: 0, gifts: 0, likes: 0, updatedAt: now };
  const next = patch({ ...prev, name: displayName(username, nickname) || prev.name });
  const entries = prune({ ...session.entries, [key]: { ...next, updatedAt: now } });
  return { ...session, lastEventAt: now, entries };
}

/** Keeps storage bounded on very large streams by dropping the lowest scores. */
function prune(entries: Record<string, LeaderEntry>): Record<string, LeaderEntry> {
  const keys = Object.keys(entries);
  if (keys.length <= MAX_ENTRIES) return entries;
  const score = (e: LeaderEntry) => e.coins + e.gifts + e.likes;
  const kept = keys.sort((a, b) => score(entries[b]) - score(entries[a])).slice(0, KEEP_AFTER_PRUNE);
  return Object.fromEntries(kept.map((k) => [k, entries[k]]));
}

export function addGift(session: LeaderboardSession, gift: GiftInput, now: number): LeaderboardSession {
  const count = positive(gift.repeatCount) || 1;
  const value = gift.diamondCount !== undefined && Number.isFinite(gift.diamondCount) && gift.diamondCount >= 0 ? Math.floor(gift.diamondCount) : null;
  const next = upsert(session, gift.username, gift.nickname, now, (e) => ({
    ...e,
    gifts: e.gifts + count,
    coins: e.coins + (value ?? 0) * count,
  }));
  return value === null ? { ...next, missingValue: true } : next;
}

export function addLike(session: LeaderboardSession, like: LikeInput, now: number): LeaderboardSession {
  const likes = positive(like.likeCount);
  if (!likes) return session;
  return upsert(session, like.username, like.nickname, now, (e) => ({ ...e, likes: e.likes + likes }));
}

export function scoreMode(session: LeaderboardSession): ScoreMode {
  return session.missingValue ? 'count' : 'coins';
}

export function rank(session: LeaderboardSession, kind: LeaderboardKind, topN: number): RankedRow[] {
  const mode = scoreMode(session);
  const scoreOf = (e: LeaderEntry) => (kind === 'likers' ? e.likes : mode === 'coins' ? e.coins : e.gifts);
  return Object.entries(session.entries)
    .map(([key, e]) => ({ key, name: e.name, score: scoreOf(e), updatedAt: e.updatedAt }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.updatedAt - b.updatedAt || a.key.localeCompare(b.key))
    .slice(0, Math.max(1, topN))
    .map((r, i) => ({ rank: i + 1, key: r.key, name: r.name, score: r.score }));
}

/**
 * "Each stream" reset: TikFinity documents no stream-start event, so a gap of
 * `gapHours` without any event is treated as the start of a new stream.
 */
export function shouldStartNewSession(session: LeaderboardSession, now: number, gapHours: number): boolean {
  return session.lastEventAt > 0 && now - session.lastEventAt > gapHours * 3_600_000;
}

/** Validates data read back from storage; anything unusable becomes an empty session. */
export function sanitizeSession(raw: unknown, now: number): LeaderboardSession {
  if (!raw || typeof raw !== 'object') return createSession(now);
  const o = raw as Record<string, unknown>;
  if (o.version !== SESSION_VERSION || typeof o.entries !== 'object' || o.entries === null) return createSession(now);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const entries: Record<string, LeaderEntry> = {};
  for (const [key, v] of Object.entries(o.entries as Record<string, unknown>).slice(0, MAX_ENTRIES)) {
    if (!v || typeof v !== 'object' || !key) continue;
    const e = v as Record<string, unknown>;
    entries[key.slice(0, 64)] = {
      name: typeof e.name === 'string' && e.name.trim() ? e.name.slice(0, 40) : key.slice(0, 40),
      coins: num(e.coins),
      gifts: num(e.gifts),
      likes: num(e.likes),
      updatedAt: num(e.updatedAt),
    };
  }
  return {
    version: SESSION_VERSION,
    startedAt: num(o.startedAt) || now,
    lastEventAt: num(o.lastEventAt),
    missingValue: o.missingValue === true,
    entries,
  };
}
