import { describe, expect, it } from 'vitest';
import { SHAPES } from '../effects/types';
import type { GiftEvent } from '../events/types';
import { BUILDER_EFFECTS, EFFECT_CATEGORIES, getBuilderEffect, splitEmojis } from './effects';
import { buildMappingPlay } from './play';
import { defaultMapping, sanitizeEffectSettings } from './validate';

const giftEvent = (giftName = 'Lion', repeatCount = 1): GiftEvent => ({
  id: 'e1',
  timestamp: 0,
  source: 'mock',
  user: { username: 'u' },
  type: 'gift',
  giftName,
  repeatCount,
});

const drawable = new Set<string>([...SHAPES, 'emoji']);

describe('builder effect gallery', () => {
  it('has unique ids and a known category for every effect', () => {
    const ids = BUILDER_EFFECTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    BUILDER_EFFECTS.forEach((e) => expect(EFFECT_CATEGORIES).toContain(e.category));
  });

  it.each(BUILDER_EFFECTS.map((e) => [e.id]))('%s builds valid bursts from its defaults', (id) => {
    const effect = getBuilderEffect(id);
    const settings = sanitizeEffectSettings({}, id);
    const bursts = effect.build(settings, giftEvent());
    expect(bursts.length).toBeGreaterThan(0);
    for (const b of bursts) {
      expect(b.count).toBeGreaterThan(0);
      expect(b.colors.length).toBeGreaterThan(0);
      b.shapes.forEach((s) => expect(drawable).toContain(s));
      if (b.shapes.includes('emoji')) expect(b.emoji?.length).toBeGreaterThan(0);
    }
  });

  it('hero effects carry a centre icon; the gift moment uses the gift’s own icon', () => {
    const play = buildMappingPlay({ ...defaultMapping('Lion', null, 'gift-hero') }, giftEvent('Lion'));
    expect(play.hero).toMatchObject({ icon: '🦁' });
    const unknown = buildMappingPlay({ ...defaultMapping('Mystery Gift', null, 'gift-hero') }, giftEvent('Mystery Gift'));
    expect(unknown.hero?.icon).toBe('🎁');
    expect(buildMappingPlay(defaultMapping('Rose', null, 'royal-crown'), giftEvent('Rose')).hero?.icon).toBe('👑');
    expect(buildMappingPlay(defaultMapping('Rose', null, 'rose-rain'), giftEvent('Rose')).hero).toBeUndefined();
  });

  it('bigger combos produce more particles', () => {
    const settings = sanitizeEffectSettings({}, 'money-rain');
    const total = (n: number) => getBuilderEffect('money-rain').build(settings, giftEvent('Rose', n)).reduce((sum, b) => sum + b.count, 0);
    expect(total(5)).toBeGreaterThan(total(1));
  });
});

describe('emoji settings', () => {
  it('splits emoji by grapheme, keeping joined emoji whole', () => {
    expect(splitEmojis('🎉🔥😍')).toEqual(['🎉', '🔥', '😍']);
    expect(splitEmojis('👨‍👩‍👧 💯')).toEqual(['👨‍👩‍👧', '💯']);
    expect(splitEmojis('')).toEqual(['✨']);
    expect(splitEmojis('🎉'.repeat(20))).toHaveLength(12);
  });

  it('only emoji effects keep an emojis setting, with a default when empty', () => {
    expect(sanitizeEffectSettings({}, 'emoji-storm').emojis).toBe('🎉🔥😍💯✨');
    expect(sanitizeEffectSettings({ emojis: '   ' }, 'emoji-storm').emojis).toBe('🎉🔥😍💯✨');
    expect(sanitizeEffectSettings({ emojis: '🌙⭐' }, 'emoji-storm').emojis).toBe('🌙⭐');
    expect(sanitizeEffectSettings({ emojis: '🌙' }, 'rose-rain')).not.toHaveProperty('emojis');
  });
});
