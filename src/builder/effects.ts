// Effect gallery for the Gift Overlay Builder. Every effect is expressed as
// BurstConfigs for the existing ParticleSystem; the "live-*" entries reuse the
// LIVE Overlay Effects presets through the existing buildPlay().

import { buildPlay } from '../effects/registry';
import { DEFAULT_SETTINGS } from '../effects/settings';
import type { BurstConfig, EffectId, ShapeKind } from '../effects/types';
import type { OverlayEvent } from '../events/types';
import type { BuilderEffectId, BuilderEffectSettings, Intensity } from './types';

export interface BuilderEffect {
  id: BuilderEffectId;
  label: string;
  description: string;
  /** Shapes drawn on the gallery thumbnail. */
  thumb: ShapeKind[];
  defaults: Omit<BuilderEffectSettings, 'intensity'>;
  build(settings: BuilderEffectSettings, event: OverlayEvent): BurstConfig[];
}

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
  live('gift', 'LIVE: Gift Alert', 'Existing project effect: rose fountain + petals', ['rose', 'petal']),
  live('follow', 'LIVE: Follow Alert', 'Existing project effect: floating hearts', ['heart', 'sparkle']),
  live('like', 'LIVE: Like Alert', 'Existing project effect: tap burst', ['heart', 'circle']),
  live('custom', 'LIVE: Custom Effect', 'Existing project effect: star burst', ['star', 'sparkle']),
];

export function getBuilderEffect(id: BuilderEffectId): BuilderEffect {
  return BUILDER_EFFECTS.find((e) => e.id === id) ?? BUILDER_EFFECTS[0];
}
