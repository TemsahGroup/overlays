import { describe, expect, it } from 'vitest';
import { addGift, addPerson, createSpotlight, sanitizeSpotlightState, shouldStartNew } from './store';
import { newSpotlight, sanitizeItems, sanitizePublicSpotlight, sanitizeSpotlight, toPublicSpotlight } from './validate';

const T0 = 1_700_000_000_000;

describe('spotlight state', () => {
  it('keeps the last gift and the biggest combo by coin value', () => {
    let s = createSpotlight(T0);
    s = addGift(s, { name: 'a', giftName: 'Rose', repeatCount: 10, diamondCount: 1 }, T0 + 1); // 10 coins
    s = addGift(s, { name: 'b', giftName: 'Doughnut', repeatCount: 1, diamondCount: 30 }, T0 + 2); // 30 coins
    s = addGift(s, { name: 'c', giftName: 'Rose', repeatCount: 1, diamondCount: 1 }, T0 + 3);
    expect(s.lastGift).toMatchObject({ name: 'c', giftName: 'Rose', count: 1 });
    expect(s.biggestGift).toMatchObject({ name: 'b', coins: 30 });
  });

  it('a tie keeps the earlier biggest gift', () => {
    let s = createSpotlight(T0);
    s = addGift(s, { name: 'first', giftName: 'Rose', repeatCount: 5, diamondCount: 1 }, T0 + 1);
    s = addGift(s, { name: 'second', giftName: 'Rose', repeatCount: 5, diamondCount: 1 }, T0 + 2);
    expect(s.biggestGift?.name).toBe('first');
  });

  it('compares gift counts once a gift arrives without a value', () => {
    let s = createSpotlight(T0);
    s = addGift(s, { name: 'a', giftName: 'Lion', repeatCount: 1, diamondCount: 29999 }, T0 + 1);
    s = addGift(s, { name: 'b', giftName: 'Rose', repeatCount: 3 }, T0 + 2);
    expect(s.missingValue).toBe(true);
    expect(s.biggestGift?.name).toBe('b');
  });

  it('tracks the last follower and share, and resets after a long break', () => {
    let s = addPerson(createSpotlight(T0), 'follow', 'f1', T0 + 1);
    s = addPerson(s, 'share', 's1', T0 + 2);
    expect([s.lastFollow?.name, s.lastShare?.name]).toEqual(['f1', 's1']);
    expect(shouldStartNew(s, T0 + 2 * 3_600_000, 3)).toBe(false);
    expect(shouldStartNew(s, T0 + 4 * 3_600_000, 3)).toBe(true);
  });

  it('survives corrupted storage data', () => {
    expect(sanitizeSpotlightState('x', T0).lastGift).toBeUndefined();
    const s = sanitizeSpotlightState({ version: 1, lastGift: { name: 'a', giftName: 'Rose', count: -2 }, lastFollow: { name: 5 } }, T0);
    expect(s.lastGift).toMatchObject({ name: 'a', count: 1 });
    expect(s.lastFollow).toBeUndefined();
  });
});

describe('spotlight config validation', () => {
  it('keeps known items in order, never empty', () => {
    expect(sanitizeItems(['lastShare', 'bogus', 'lastShare', 'lastGift'])).toEqual(['lastShare', 'lastGift']);
    expect(sanitizeItems([])).toEqual(['lastGift', 'biggestGift']);
  });

  it('applies defaults and drops the owner publicly', () => {
    const c = sanitizeSpotlight({ id: 'abcdef123', ownerId: 'owner12345', style: 'weird', layout: 'x', rotateSeconds: 99 });
    expect(c).toMatchObject({ style: 'pill', layout: 'stack', rotateSeconds: 30 });
    const pub = toPublicSpotlight(newSpotlight('owner12345'));
    expect(pub).not.toHaveProperty('ownerId');
    expect(sanitizePublicSpotlight(pub)?.items).toEqual(['lastGift', 'biggestGift']);
  });
});
