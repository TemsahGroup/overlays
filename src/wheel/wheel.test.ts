import { describe, expect, it } from 'vitest';
import { pickSegment, segmentAt, spinTarget, spinsFor } from './spin';
import { newWheel, presetSegments, sanitizePublicWheel, sanitizeSegments, sanitizeWheel, toPublicWheel } from './validate';

describe('wheel maths', () => {
  it('lands exactly on the chosen segment, always moving forward', () => {
    for (const count of [2, 3, 6, 7, 12]) {
      let rotation = 0;
      for (let index = 0; index < count; index++) {
        for (const r of [0, 0.5, 0.999]) {
          const next = spinTarget(rotation, index, count, 6, () => r);
          expect(next).toBeGreaterThanOrEqual(rotation + 6 * 360);
          expect(next).toBeLessThan(rotation + 7 * 360);
          expect(segmentAt(next, count)).toBe(index);
          rotation = next;
        }
      }
    }
  });

  it('picks every segment and never goes out of range', () => {
    expect(pickSegment(6, () => 0)).toBe(0);
    expect(pickSegment(6, () => 0.9999)).toBe(5);
    expect(pickSegment(6, () => 1)).toBe(5);
  });
});

describe('wheel triggers', () => {
  const byGift = { trigger: 'gift' as const, giftName: 'Rose', minCoins: 100, spinEach: true };
  it('a chosen gift spins once per gift, or once per combo', () => {
    expect(spinsFor(byGift, { giftName: ' rose ', repeatCount: 5 })).toBe(5);
    expect(spinsFor({ ...byGift, spinEach: false }, { giftName: 'Rose', repeatCount: 5 })).toBe(1);
    expect(spinsFor(byGift, { giftName: 'Lion', repeatCount: 1 })).toBe(0);
  });

  it('big gifts need a known coin value that reaches the minimum', () => {
    const byCoins = { ...byGift, trigger: 'coins' as const };
    expect(spinsFor(byCoins, { giftName: 'Rose', repeatCount: 99, diamondCount: 1 })).toBe(0);
    expect(spinsFor(byCoins, { giftName: 'Rose', repeatCount: 100, diamondCount: 1 })).toBe(1);
    expect(spinsFor(byCoins, { giftName: 'Lion', repeatCount: 1 })).toBe(0);
  });
});

describe('wheel config validation', () => {
  it('keeps 2–12 segments with valid colours and labels', () => {
    expect(sanitizeSegments([{ label: 'a' }])).toHaveLength(6); // too few → preset
    const many = Array.from({ length: 20 }, (_, i) => ({ label: `s${i}`, color: 'red' }));
    const kept = sanitizeSegments(many);
    expect(kept).toHaveLength(12);
    expect(kept[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(sanitizeSegments([{ label: '' }, { label: 'x'.repeat(40), color: '#000000' }])).toEqual([
      { label: '#1', color: '#fe2c55' },
      { label: 'x'.repeat(24), color: '#000000' },
    ]);
  });

  it('applies defaults and limits', () => {
    const c = sanitizeWheel({ id: 'abcdef123', ownerId: 'owner12345', style: 'weird', spinSeconds: 99, minCoins: 0, trigger: 'nope' });
    expect(c).toMatchObject({ style: 'classic', spinSeconds: 10, minCoins: 1, trigger: 'gift', giftName: 'Rose', spinEach: true, hideWhenIdle: false });
  });

  it('public projection drops the owner; presets exist in both languages', () => {
    const pub = toPublicWheel(newWheel('owner12345'));
    expect(pub).not.toHaveProperty('ownerId');
    expect(sanitizePublicWheel(pub)?.segments.length).toBeGreaterThanOrEqual(2);
    expect(presetSegments('prizes', 'ar')).toHaveLength(6);
    expect(presetSegments('yesno', 'en')[0].label).toContain('Yes');
  });
});
