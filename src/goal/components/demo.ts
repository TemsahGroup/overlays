// TEST progress for previews and ?demo=1. Never persisted, always flagged TEST.

import { addAmount, addGift, type GoalProgress } from '../store';
import type { GoalMetric } from '../types';

const TEST_GIFTS = [1, 1, 5, 10, 30, 99];
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** One random step toward the goal, roughly 1/40 of the target on average. */
export function demoStep(p: GoalProgress, metric: GoalMetric, target: number, now: number): GoalProgress {
  if (metric === 'coins') return addGift(p, { repeatCount: 1 + Math.floor(Math.random() * 3), diamondCount: Math.max(1, Math.round((pick(TEST_GIFTS) * target) / 1000)) }, now);
  const step = Math.max(1, Math.round((target / 40) * (0.5 + Math.random())));
  return addAmount(p, step, now);
}
