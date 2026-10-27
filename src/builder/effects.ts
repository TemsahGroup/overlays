// Effect gallery for the Gift Overlay Builder. Every effect is expressed as
// BurstConfigs for the existing ParticleSystem; the "live-*" entries reuse the
// LIVE Overlay Effects presets through the existing buildPlay().

import { buildPlay } from '../effects/registry';
import { DEFAULT_SETTINGS } from '../effects/settings';
import type { HeroConfig } from '../effects/hero/HeroEffect';
import type { BurstConfig, EffectId, ShapeKind } from '../effects/types';
import type { OverlayEvent } from '../events/types';
import { giftIcon } from './gifts';
import type { BuilderEffectId, BuilderEffectSettings, Intensity } from './types';

export type EffectCategory = 'classic' | 'occasions' | 'luxury' | 'party' | 'hero';
export const EFFECT_CATEGORIES: EffectCategory[] = ['classic', 'occasions', 'luxury', 'party', 'hero'];

export interface BuilderEffect {
  id: BuilderEffectId;
  label: string;
  description: string;
  category: EffectCategory;
  /** Highlighted in the gallery as new. */
  isNew?: boolean;
  /** Shapes drawn on the gallery thumbnail. */
  thumb: ShapeKind[];
  /** Characters for 'emoji' shapes on the thumbnail. */
  thumbEmoji?: string[];
  defaults: Omit<BuilderEffectSettings, 'intensity'>;
  build(settings: BuilderEffectSettings, event: OverlayEvent): BurstConfig[];
  /** Optional giant centre icon ("hero moment"). */
  hero?(settings: BuilderEffectSettings, event: OverlayEvent): HeroConfig;
}

/** Splits "🎉🔥😍" into individual emoji (grapheme clusters, so 👨‍👩‍👧 stays whole). */
export function splitEmojis(text: string | undefined, fallback: string[] = ['✨']): string[] {
  if (!text) return fallback;
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  const parts = Segmenter ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment) : Array.from(text);
  const list = parts.filter((p) => p.trim()).slice(0, 12);
  return list.length ? list : fallback;
}

/** Icon for hero moments: the gift's emoji, or 🎁 for unknown gifts. */
const heroIcon = (event: OverlayEvent) => (event.type === 'gift' ? giftIcon(event.giftName) : '🎁');

const INTENSITY: Record<Intensity, number> = { low: 0.6, medium: 1, high: 1.6 };

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Particle count after intensity, combo size and reduced-motion. */
function scaledCount(s: BuilderEffectSettings, event: OverlayEvent): number {
  const combo = event.type === 'gift' ? Math.min(event.repeatCount, 5) : 1;
  const comboBoost = 1 + (combo - 1) * 0.35;
  const motion = prefersReducedMotion() ? 0.35 : 1;
  return Math.max(1, Math.round(s.count * INTENSITY[s.intensity] * comboBoost * motion));
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function fromLiveEffect(id: EffectId, s: BuilderEffectSettings, event: OverlayEvent): BurstConfig[] {
  const base = DEFAULT_SETTINGS[id];
  return buildPlay(id, { ...base, colors: s.colors, count: scaledCount(s, event), duration: s.duration, size: s.size }, event).bursts;
}

const live = (id: EffectId, label: string, description: string, thumb: ShapeKind[]): BuilderEffect => ({
  id: `live-${id}` as BuilderEffectId,
  label,
  description,
  category: 'classic',
  thumb,
  defaults: {
    colors: DEFAULT_SETTINGS[id].colors,
    count: DEFAULT_SETTINGS[id].count,
    duration: DEFAULT_SETTINGS[id].duration,
    size: DEFAULT_SETTINGS[id].size,
  },
  build: (s, e) => fromLiveEffect(id, s, e),
});

export const BUILDER_EFFECTS: BuilderEffect[] = [
  {
    id: 'rose-rain',
    category: 'classic',
    label: 'Rose Rain',
    description: 'Roses and petals drift down across the screen',
    thumb: ['rose', 'petal', 'petal'],
    defaults: { colors: ['#ff2d55', '#ff6b8b', '#c9184a', '#ffb3c6'], count: 34, duration: 5000, size: 42 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      const common = { colors: s.colors, emitter: 'rain' as const, duration: s.duration, emitOver: s.duration * 0.55 };
      return [
        { ...common, shapes: ['rose'], count, size: s.size },
        { ...common, shapes: ['petal'], count: Math.round(count * 1.5), size: s.size * 0.45 },
      ];
    },
  },
  {
    id: 'fireworks',
    category: 'classic',
    label: 'Fireworks',
    description: 'Salvos of sparkling bursts across the top of the screen',
    thumb: ['sparkle', 'circle', 'star'],
    defaults: { colors: ['#ffd166', '#25f4ee', '#ff5fd2', '#7c5cff', '#ffffff'], count: 120, duration: 4200, size: 18 },
    build: (s, e) => {
      const salvos = { low: 3, medium: 4, high: 6 }[s.intensity];
      const perSalvo = Math.max(8, Math.round(scaledCount(s, e) / salvos));
      return Array.from({ length: salvos }, (_, i) => ({
        // One colour per salvo looks like a real firework shell.
        shapes: ['sparkle', 'circle'] as ShapeKind[],
        colors: [s.colors[i % s.colors.length]],
        count: perSalvo,
        size: s.size,
        emitter: 'burst' as const,
        duration: s.duration * 0.55,
        emitOver: 60,
        origin: { x: rand(0.18, 0.82), y: rand(0.18, 0.48) },
        delay: (i * s.duration * 0.45) / salvos,
      }));
    },
  },
  {
    id: 'hearts',
    category: 'classic',
    label: 'Hearts',
    description: 'Glossy hearts float up with sparkles',
    thumb: ['heart', 'heart', 'sparkle'],
    defaults: { colors: ['#ff4d8d', '#ff8fb1', '#fe2c55', '#ffd1e0'], count: 30, duration: 4500, size: 40 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      const common = { colors: s.colors, emitter: 'float' as const, duration: s.duration, emitOver: s.duration * 0.45 };
      return [
        { ...common, shapes: ['heart'], count, size: s.size },
        { ...common, shapes: ['sparkle'], count: Math.round(count * 0.6), size: s.size * 0.45 },
      ];
    },
  },
  {
    id: 'gift-explosion',
    category: 'classic',
    label: 'Gift Explosion',
    description: 'A centre blast plus confetti cannons from both corners',
    thumb: ['confetti', 'star', 'circle'],
    defaults: { colors: ['#ffd166', '#fe2c55', '#25f4ee', '#7c5cff', '#ffffff'], count: 110, duration: 4000, size: 24 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      return [
        { shapes: ['star', 'confetti', 'circle'], colors: s.colors, count, size: s.size, emitter: 'burst', duration: s.duration, emitOver: 120 },
        { shapes: ['confetti'], colors: s.colors, count: Math.round(count * 0.8), size: s.size * 0.8, emitter: 'cannons', duration: s.duration, emitOver: s.duration * 0.25, delay: 150 },
      ];
    },
  },
  // ---------- Occasions ----------
  {
    id: 'ramadan-lanterns',
    label: 'Ramadan lanterns',
    description: 'Glowing fanous lanterns drift down with golden stars',
    category: 'occasions',
    isNew: true,
    thumb: ['lantern', 'sparkle', 'crescent'],
    defaults: { colors: ['#ffb703', '#e85d04', '#2a9d8f', '#9b5de5'], count: 14, duration: 6500, size: 58 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      const common = { emitter: 'rain' as const, duration: s.duration, emitOver: s.duration * 0.5, speedScale: 0.55 };
      return [
        { ...common, shapes: ['lantern'], colors: s.colors, count, size: s.size },
        { ...common, shapes: ['sparkle', 'star'], colors: ['#ffd166', '#fff3c4'], count: Math.round(count * 2), size: s.size * 0.32 },
        { ...common, shapes: ['crescent'], colors: ['#ffd166'], count: Math.max(2, Math.round(count / 5)), size: s.size * 0.8 },
      ];
    },
  },
  {
    id: 'eid-celebration',
    label: 'Eid celebration',
    description: 'Crescents and stars burst out, then festive confetti cannons',
    category: 'occasions',
    isNew: true,
    thumb: ['crescent', 'star', 'confetti'],
    defaults: { colors: ['#ffd166', '#2a9d8f', '#e63946', '#ffffff'], count: 90, duration: 4800, size: 24 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      return [
        { shapes: ['crescent', 'star', 'sparkle'], colors: s.colors, count: Math.round(count * 0.5), size: s.size * 1.9, emitter: 'burst', duration: s.duration, emitOver: 150 },
        { shapes: ['confetti', 'star'], colors: s.colors, count, size: s.size, emitter: 'cannons', duration: s.duration, emitOver: s.duration * 0.3, delay: 250 },
      ];
    },
  },
  // ---------- Money & luxury ----------
  {
    id: 'money-rain',
    label: 'Money rain',
    description: 'Bills and gold coins rain from the top',
    category: 'luxury',
    isNew: true,
    thumb: ['emoji', 'coin', 'emoji'],
    thumbEmoji: ['💵', '💸'],
    defaults: { colors: ['#ffd166', '#f4a261'], count: 40, duration: 5200, size: 46 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      const common = { emitter: 'rain' as const, duration: s.duration, emitOver: s.duration * 0.55 };
      return [
        { ...common, shapes: ['emoji'], emoji: ['💵', '💸', '💵'], colors: s.colors, count, size: s.size },
        { ...common, shapes: ['coin'], colors: s.colors, count: Math.round(count * 0.9), size: s.size * 0.55 },
      ];
    },
  },
  {
    id: 'coin-fountain',
    label: 'Gold fountain',
    description: 'A fountain of spinning gold coins',
    category: 'luxury',
    isNew: true,
    thumb: ['coin', 'sparkle', 'coin'],
    defaults: { colors: ['#ffd166', '#fca311'], count: 55, duration: 4200, size: 32 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      return [
        { shapes: ['coin'], colors: s.colors, count, size: s.size, emitter: 'fountain', duration: s.duration, emitOver: s.duration * 0.4 },
        { shapes: ['sparkle'], colors: ['#fff3c4', ...s.colors], count: Math.round(count * 0.6), size: s.size * 0.5, emitter: 'fountain', duration: s.duration, emitOver: s.duration * 0.4 },
      ];
    },
  },
  {
    id: 'diamond-shower',
    label: 'Diamond shower',
    description: 'Sparkling diamonds fall with glints of light',
    category: 'luxury',
    isNew: true,
    thumb: ['gem', 'sparkle', 'gem'],
    defaults: { colors: ['#4cc9f0', '#b5179e', '#ffffff', '#7209b7'], count: 32, duration: 5000, size: 42 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      const common = { emitter: 'rain' as const, duration: s.duration, emitOver: s.duration * 0.5, speedScale: 0.8 };
      return [
        { ...common, shapes: ['gem'], colors: s.colors, count, size: s.size },
        { ...common, shapes: ['sparkle'], colors: ['#ffffff', ...s.colors], count: Math.round(count * 1.4), size: s.size * 0.4 },
      ];
    },
  },
  {
    id: 'royal-crown',
    label: 'Royal crown',
    description: 'A giant crown lands with a golden blast',
    category: 'luxury',
    isNew: true,
    thumb: ['emoji', 'coin', 'sparkle'],
    thumbEmoji: ['👑'],
    defaults: { colors: ['#ffd166', '#fca311', '#ffffff'], count: 80, duration: 4800, size: 26 },
    hero: (s) => ({ icon: '👑', colors: s.colors, duration: s.duration }),
    build: (s, e) => {
      const count = scaledCount(s, e);
      const impact = { origin: { x: 0.5, y: 0.45 }, delay: 550, emitter: 'burst' as const, duration: s.duration * 0.8, emitOver: 80 };
      return [
        { ...impact, shapes: ['coin', 'star'], colors: s.colors, count, size: s.size },
        { ...impact, shapes: ['sparkle'], colors: s.colors, count: Math.round(count * 0.6), size: s.size * 0.6 },
      ];
    },
  },
  // ---------- Party ----------
  {
    id: 'balloon-party',
    label: 'Balloon party',
    description: 'Colourful balloons float up with confetti',
    category: 'party',
    isNew: true,
    thumb: ['balloon', 'confetti', 'balloon'],
    defaults: { colors: ['#ff4d6d', '#4cc9f0', '#ffd166', '#7bf1a8', '#c77dff'], count: 22, duration: 6500, size: 60 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      return [
        { shapes: ['balloon'], colors: s.colors, count, size: s.size, emitter: 'float', duration: s.duration, emitOver: s.duration * 0.45, speedScale: 0.85 },
        { shapes: ['confetti'], colors: s.colors, count: Math.round(count * 3), size: s.size * 0.3, emitter: 'rain', duration: s.duration, emitOver: s.duration * 0.4 },
      ];
    },
  },
  {
    id: 'confetti-storm',
    label: 'Confetti storm',
    description: 'Cannons on both sides plus a confetti downpour',
    category: 'party',
    isNew: true,
    thumb: ['confetti', 'star', 'confetti'],
    defaults: { colors: ['#fe2c55', '#25f4ee', '#ffd166', '#7c5cff', '#ffffff'], count: 150, duration: 4800, size: 20 },
    build: (s, e) => {
      const count = scaledCount(s, e);
      return [
        { shapes: ['confetti', 'star'], colors: s.colors, count, size: s.size, emitter: 'cannons', duration: s.duration, emitOver: s.duration * 0.25 },
        { shapes: ['confetti'], colors: s.colors, count, size: s.size * 0.9, emitter: 'rain', duration: s.duration, emitOver: s.duration * 0.5, delay: 400 },
      ];
    },
  },
  {
    id: 'emoji-storm',
    label: 'Emoji storm',
    description: 'Your own emojis explode across the screen',
    category: 'party',
    isNew: true,
    thumb: ['emoji', 'emoji', 'emoji'],
    thumbEmoji: ['🎉', '🔥', '😍', '💯'],
    defaults: { colors: ['#ffffff'], count: 45, duration: 4200, size: 42, emojis: '🎉🔥😍💯✨' },
    build: (s, e) => {
      const count = scaledCount(s, e);
      const emoji = splitEmojis(s.emojis, ['🎉']);
      return [
        { shapes: ['emoji'], emoji, colors: s.colors, count: Math.round(count * 0.6), size: s.size, emitter: 'burst', duration: s.duration, emitOver: 200 },
        { shapes: ['emoji'], emoji, colors: s.colors, count: Math.round(count * 0.5), size: s.size * 0.8, emitter: 'fountain', duration: s.duration, emitOver: s.duration * 0.35, delay: 300 },
      ];
    },
  },
  // ---------- Big moments ----------
  {
    id: 'gift-hero',
    label: 'Big gift moment',
    description: 'The gift itself lands in the middle with light rays and a shockwave',
    category: 'hero',
    isNew: true,
    thumb: ['emoji', 'star', 'sparkle'],
    thumbEmoji: ['🦁'],
    defaults: { colors: ['#fe2c55', '#25f4ee', '#ffd166', '#ffffff'], count: 110, duration: 5000, size: 26 },
    hero: (s, e) => ({ icon: heroIcon(e), colors: s.colors, duration: s.duration }),
    build: (s, e) => {
      const count = scaledCount(s, e);
      const impact = { origin: { x: 0.5, y: 0.45 }, delay: 550, duration: s.duration * 0.8 };
      return [
        { ...impact, shapes: ['star', 'confetti', 'circle'], colors: s.colors, count, size: s.size, emitter: 'burst', emitOver: 80 },
        { shapes: ['confetti'], colors: s.colors, count: Math.round(count * 0.7), size: s.size * 0.8, emitter: 'cannons', duration: s.duration, emitOver: s.duration * 0.25, delay: 700 },
      ];
    },
  },
  live('gift', 'LIVE: Gift Alert', 'Existing project effect: rose fountain + petals', ['rose', 'petal']),
  live('follow', 'LIVE: Follow Alert', 'Existing project effect: floating hearts', ['heart', 'sparkle']),
  live('like', 'LIVE: Like Alert', 'Existing project effect: tap burst', ['heart', 'circle']),
  live('custom', 'LIVE: Custom Effect', 'Existing project effect: star burst', ['star', 'sparkle']),
];

export function getBuilderEffect(id: BuilderEffectId): BuilderEffect {
  return BUILDER_EFFECTS.find((e) => e.id === id) ?? BUILDER_EFFECTS[0];
}
