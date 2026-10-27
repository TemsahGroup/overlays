import { describe, expect, it } from 'vitest';
import { addAmount, addGift, createProgress, goalState, progressValue, sanitizeProgress, shouldStartNew } from './store';
import { newGoal, sanitizeGoal, sanitizePublicGoal, toPublicGoal } from './validate';

const T0 = 1_700_000_000_000;

describe('goal progress', () => {
  it('counts coin value (diamondCount × repeatCount)', () => {
    let p = createProgress(T0);
    p = addGift(p, { repeatCount: 5, diamondCount: 1 }, T0 + 1);
    p = addGift(p, { repeatCount: 1, diamondCount: 99 }, T0 + 2);
    expect(progressValue(p, true)).toBe(104);
  });

  it('switches to counting gifts when a gift has no value', () => {
    let p = createProgress(T0);
    p = addGift(p, { repeatCount: 1, diamondCount: 500 }, T0 + 1);
    p = addGift(p, { repeatCount: 3 }, T0 + 2);
    expect(p.missingValue).toBe(true);
    expect(progressValue(p, true)).toBe(4);
  });

  it('adds likes, follows and shares; ignores non-positive amounts', () => {
    let p = createProgress(T0);
    p = addAmount(p, 15, T0 + 1);
    p = addAmount(p, 0, T0 + 2);
    p = addAmount(p, -3, T0 + 3);
    expect(progressValue(p, false)).toBe(15);
    expect(p.lastEventAt).toBe(T0 + 1);
  });

  it('starts a new stream after the gap and survives bad storage data', () => {
    const p = addAmount(createProgress(T0), 1, T0);
    expect(shouldStartNew(p, T0 + 2 * 3_600_000, 3)).toBe(false);
    expect(shouldStartNew(p, T0 + 3 * 3_600_000 + 1, 3)).toBe(true);
    expect(sanitizeProgress('x', T0).amount).toBe(0);
    expect(sanitizeProgress({ version: 1, amount: -4, coins: 7 }, T0)).toMatchObject({ amount: 0, coins: 7 });
  });
});

describe('goal state', () => {
  it('fixed goal: fills up and stays full', () => {
    expect(goalState(250, 1000, false)).toEqual({ level: 1, goal: 1000, ratio: 0.25, done: false });
    expect(goalState(1500, 1000, false)).toEqual({ level: 1, goal: 1000, ratio: 1, done: true });
  });

  it('auto-next: 2×, 3× … with the bar restarting each time', () => {
    expect(goalState(999, 1000, true)).toMatchObject({ level: 1, goal: 1000 });
    expect(goalState(1000, 1000, true)).toMatchObject({ level: 2, goal: 2000, ratio: 0 });
    expect(goalState(2500, 1000, true)).toMatchObject({ level: 3, goal: 3000, ratio: 0.5 });
  });
});

describe('goal config validation', () => {
  it('applies per-metric defaults and limits', () => {
    const base = { id: 'abcdef123', ownerId: 'owner12345' };
    expect(sanitizeGoal(base)).toMatchObject({ metric: 'coins', style: 'classic', target: 1000, autoNext: false });
    expect(sanitizeGoal({ ...base, metric: 'follows' })).toMatchObject({ target: 100, title: 'Follow goal' });
    expect(sanitizeGoal({ ...base, target: 0, style: 'ring' })).toMatchObject({ target: 1, style: 'ring' });
    expect(sanitizeGoal({ ...base, metric: 'weird', style: 'weird' })).toMatchObject({ metric: 'coins', style: 'classic' });
  });

  it('public projection drops the owner', () => {
    const pub = toPublicGoal(newGoal('owner12345', 'likes'));
    expect(pub).not.toHaveProperty('ownerId');
    expect(sanitizePublicGoal(pub)?.metric).toBe('likes');
    expect(sanitizePublicGoal({ id: 'bad id' })).toBeNull();
  });
});
