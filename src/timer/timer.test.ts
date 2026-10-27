import { describe, expect, it } from 'vitest';
import { addTime, createTimer, formatAdd, formatTime, giftSeconds, isOver, likeSeconds, pause, resume, sanitizeTimerState, shouldStartNew, timeLeft } from './store';
import { newTimer, sanitizePublicTimer, sanitizeTimer, toPublicTimer } from './validate';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe('countdown', () => {
  it('counts down while running and holds while paused', () => {
    let s = createTimer(10 * MIN, T0, true);
    expect(timeLeft(s, T0 + MIN)).toBe(9 * MIN);
    s = pause(s, T0 + MIN);
    expect(timeLeft(s, T0 + 5 * MIN)).toBe(9 * MIN);
    s = resume(s, T0 + 5 * MIN);
    expect(timeLeft(s, T0 + 6 * MIN)).toBe(8 * MIN);
  });

  it('a timer that is not auto-started waits for Start', () => {
    const s = createTimer(10 * MIN, T0, false);
    expect(timeLeft(s, T0 + 5 * MIN)).toBe(10 * MIN);
  });

  it('adds time while running or paused, respects the cap, and stops after the end', () => {
    let s = createTimer(10 * MIN, T0, true);
    s = addTime(s, 30_000, T0);
    expect(timeLeft(s, T0)).toBe(10.5 * MIN);
    expect(s.addedMs).toBe(30_000);
    s = addTime(s, 60 * MIN, T0, 20 * MIN);
    expect(timeLeft(s, T0)).toBe(20 * MIN);
    const paused = addTime(pause(s, T0), MIN, T0, 0);
    expect(timeLeft(paused, T0 + 99 * MIN)).toBe(21 * MIN);
    const over = createTimer(MIN, T0, true);
    expect(isOver(over, T0 + MIN)).toBe(true);
    expect(addTime(over, MIN, T0 + 2 * MIN)).toBe(over);
  });

  it('streamer changes do not count as viewer time; removing never goes below zero', () => {
    let s = createTimer(MIN, T0, true);
    s = addTime(s, 5 * MIN, T0, 0, false);
    expect(s.addedMs).toBe(0);
    s = addTime(s, -99 * MIN, T0, 0, false);
    expect(timeLeft(s, T0)).toBe(0);
  });

  it('a long break with a finished or paused timer means a new stream', () => {
    const over = createTimer(MIN, T0, true);
    expect(shouldStartNew(over, T0 + 2 * 3_600_000, 3)).toBe(false);
    expect(shouldStartNew(over, T0 + 4 * 3_600_000, 3)).toBe(true);
    const long = createTimer(10 * 3_600_000, T0, true);
    expect(shouldStartNew(long, T0 + 4 * 3_600_000, 3)).toBe(false); // still running a subathon
    expect(sanitizeTimerState({ version: 9 })).toBeNull();
  });
});

describe('rules', () => {
  const rules = { perCoin: 10, perFollow: 30, perShare: 15, per100Likes: 5 };
  it('gifts add seconds by coin value; gifts without a value count as 1 coin', () => {
    expect(giftSeconds(rules, { repeatCount: 5, diamondCount: 1 })).toBe(50);
    expect(giftSeconds(rules, { repeatCount: 1, diamondCount: 100 })).toBe(1000);
    expect(giftSeconds(rules, { repeatCount: 2 })).toBe(20);
  });

  it('likes add time per full 100 and carry the rest', () => {
    let r = likeSeconds(rules, 0, 150);
    expect(r).toEqual({ seconds: 5, carry: 50 });
    r = likeSeconds(rules, r.carry, 60);
    expect(r).toEqual({ seconds: 5, carry: 10 });
  });

  it('formats time and additions', () => {
    expect(formatTime(65_000)).toBe('01:05');
    expect(formatTime(3_725_000)).toBe('1:02:05');
    expect(formatTime(500)).toBe('00:01');
    expect(formatAdd(30)).toBe('+30s');
    expect(formatAdd(90)).toBe('+1m 30s');
    expect(formatAdd(-60)).toBe('−1m');
    expect(formatAdd(7500)).toBe('+2h 5m');
  });
});

describe('timer config validation', () => {
  it('applies defaults and limits', () => {
    const c = sanitizeTimer({ id: 'abcdef123', ownerId: 'owner12345', style: 'weird', startMinutes: 0, maxHours: 999, rules: { perCoin: -5, perFollow: 'x' } });
    expect(c).toMatchObject({ style: 'digital', startMinutes: 1, maxHours: 72, rules: { perCoin: 0, perFollow: 30, perShare: 15, per100Likes: 0 }, autoStart: true });
  });

  it('public projection drops the owner', () => {
    const pub = toPublicTimer(newTimer('owner12345'));
    expect(pub).not.toHaveProperty('ownerId');
    expect(sanitizePublicTimer(pub)?.startMinutes).toBe(60);
  });
});
