import { describe, expect, it } from 'vitest';
import { onOverlayEvent } from '../events/eventBus';
import type { GiftEvent, OverlayEvent } from '../events/types';
import { dispatchGift, matchMapping, normalizeGift, sendTestGift, type NormalizedGiftEvent } from './giftEvents';
import { resolveConfigPlay } from './play';
import type { PublicOverlayConfig } from './types';
import { defaultMapping } from './validate';

const config = (giftName: string, giftId: string | null = null, effectId: 'rose-rain' | 'fireworks' = 'rose-rain'): PublicOverlayConfig => ({
  schemaVersion: 1,
  id: `cfg${giftName.replace(/\W/g, '')}000`,
  name: giftName,
  layout: '16:9',
  mappings: [defaultMapping(giftName, giftId, effectId)],
  enabled: true,
});

const giftEvent = (giftName: string, giftId?: string, source: GiftEvent['source'] = 'tikfinity'): GiftEvent => ({
  id: `e-${Math.random()}`,
  timestamp: 0,
  source,
  user: { username: 'u' },
  type: 'gift',
  giftId,
  giftName,
  repeatCount: 1,
});

const live = (over: Partial<NormalizedGiftEvent> = {}): NormalizedGiftEvent => ({
  type: 'gift',
  giftName: 'Rose',
  username: 'viewer',
  repeatCount: 1,
  isTest: false,
  provider: 'tikfinity',
  ...over,
});

describe('matchMapping', () => {
  it('matches by normalized gift name when no id is configured', () => {
    expect(matchMapping(config('Rose'), giftEvent('  rose '))).not.toBeNull();
    expect(matchMapping(config('Heart Me'), giftEvent('heart   me'))).not.toBeNull();
    expect(matchMapping(config('Rose'), giftEvent('Lion'))).toBeNull();
  });

  it('prefers the gift id when both sides have one', () => {
    expect(matchMapping(config('Rose', '5655'), giftEvent('Renamed Rose', '5655'))).not.toBeNull();
    expect(matchMapping(config('Rose', '5655'), giftEvent('Rose', '9999'))).toBeNull();
  });

  it('falls back to the name when the event has no id', () => {
    expect(matchMapping(config('Rose', '5655'), giftEvent('Rose'))).not.toBeNull();
  });

  it('ignores non-gift events', () => {
    const follow: OverlayEvent = { id: 'f', timestamp: 0, source: 'tikfinity', user: { username: 'u' }, type: 'follow' };
    expect(matchMapping(config('Rose'), follow)).toBeNull();
  });

  it('keeps two configurations independent', () => {
    const a = resolveConfigPlay(config('Rose', null, 'fireworks'));
    const b = resolveConfigPlay(config('Lion', null, 'rose-rain'));
    expect(a(giftEvent('Rose'))).not.toBeNull();
    expect(a(giftEvent('Lion'))).toBeNull();
    expect(b(giftEvent('Lion'))).not.toBeNull();
    expect(b(giftEvent('Rose'))).toBeNull();
  });

  it('a disabled configuration plays nothing', () => {
    const play = resolveConfigPlay({ ...config('Rose'), enabled: false });
    expect(play(giftEvent('Rose'))).toBeNull();
  });
});

describe('test-event separation', () => {
  it('only a tikfinity, non-test event becomes a live event', () => {
    expect(normalizeGift(live()).source).toBe('tikfinity');
    expect(normalizeGift(live({ isTest: true })).source).toBe('mock');
    expect(normalizeGift(live({ provider: 'mock' })).source).toBe('mock');
  });

  it('sendTestGift always produces a mock (TEST) event', () => {
    const got: OverlayEvent[] = [];
    const off = onOverlayEvent((e) => got.push(e));
    sendTestGift('Rose');
    off();
    expect(got).toHaveLength(1);
    expect(got[0].source).toBe('mock');
  });
});

describe('dispatchGift duplicate handling', () => {
  it('drops a repeated provider event id', () => {
    const got: OverlayEvent[] = [];
    const off = onOverlayEvent((e) => got.push(e));
    expect(dispatchGift(live({ eventId: 'dup-1' }))).toBe(true);
    expect(dispatchGift(live({ eventId: 'dup-1' }))).toBe(false);
    expect(dispatchGift(live({ eventId: 'dup-2' }))).toBe(true);
    off();
    expect(got.map((e) => e.id)).toEqual(['tikfinity:dup-1', 'tikfinity:dup-2']);
  });

  it('does not confuse a test event with a live event of the same id', () => {
    expect(dispatchGift(live({ eventId: 'same', provider: 'mock', isTest: true }))).toBe(true);
    expect(dispatchGift(live({ eventId: 'same' }))).toBe(true);
  });
});
