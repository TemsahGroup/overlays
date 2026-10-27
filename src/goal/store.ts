// Goal progress — pure functions, no React, no storage.
//
// Coins: diamondCount × repeatCount per final gift, as on the leaderboards. If
// any gift arrives without a value the goal switches to counting gifts, so
// coins and counts are never mixed. Likes add likeCount; follows and shares
// count one per event.

export const PROGRESS_VERSION = 1;

export interface GoalProgress {
  version: number;
  startedAt: number;
  /** 0 = no event yet in this stream. */
  lastEventAt: number;
  coins: number;
  gifts: number;
  /** Likes, follows or shares (whatever the goal counts besides coins). */
  amount: number;
  /** true once a gift arrived without a coin value → count gifts instead. */
  missingValue: boolean;
}

export function createProgress(now: number): GoalProgress {
  return { version: PROGRESS_VERSION, startedAt: now, lastEventAt: 0, coins: 0, gifts: 0, amount: 0, missingValue: false };
}

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function addGift(p: GoalProgress, gift: { repeatCount: number; diamondCount?: number }, now: number): GoalProgress {
  const count = positive(gift.repeatCount) || 1;
  const value = gift.diamondCount !== undefined && Number.isFinite(gift.diamondCount) && gift.diamondCount >= 0 ? Math.floor(gift.diamondCount) : null;
  return {
    ...p,
    lastEventAt: now,
    gifts: p.gifts + count,
    coins: p.coins + (value ?? 0) * count,
    missingValue: p.missingValue || value === null,
  };
}

export function addAmount(p: GoalProgress, n: number, now: number): GoalProgress {
  const add = positive(n);
  return add ? { ...p, lastEventAt: now, amount: p.amount + add } : p;
}

/** Current value for a coins goal or any other metric. */
export function progressValue(p: GoalProgress, coinsGoal: boolean): number {
  if (!coinsGoal) return p.amount;
  return p.missingValue ? p.gifts : p.coins;
}

export interface GoalState {
  /** 1 = first goal; grows with auto-next. */
  level: number;
  /** The amount to reach for the current goal. */
  goal: number;
  /** 0–1 progress toward the current goal. */
  ratio: number;
  done: boolean;
}

/** With auto-next, goals are target, 2×target, 3×target… otherwise one fixed goal. */
export function goalState(value: number, target: number, autoNext: boolean): GoalState {
  const t = Math.max(1, target);
  const v = Math.max(0, value);
  if (!autoNext) return { level: 1, goal: t, ratio: Math.min(1, v / t), done: v >= t };
  const level = Math.min(9999, Math.floor(v / t) + 1);
  return { level, goal: level * t, ratio: (v - (level - 1) * t) / t, done: false };
}

/** A gap of `gapHours` without events is treated as a new stream. */
export function shouldStartNew(p: GoalProgress, now: number, gapHours: number): boolean {
  return p.lastEventAt > 0 && now - p.lastEventAt > gapHours * 3_600_000;
}

export function sanitizeProgress(raw: unknown, now: number): GoalProgress {
  if (!raw || typeof raw !== 'object') return createProgress(now);
  const o = raw as Record<string, unknown>;
  if (o.version !== PROGRESS_VERSION) return createProgress(now);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    version: PROGRESS_VERSION,
    startedAt: num(o.startedAt) || now,
    lastEventAt: num(o.lastEventAt),
    coins: num(o.coins),
    gifts: num(o.gifts),
    amount: num(o.amount),
    missingValue: o.missingValue === true,
  };
}
