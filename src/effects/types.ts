export type EffectId = 'gift' | 'follow' | 'like' | 'custom';
export const EFFECT_IDS: EffectId[] = ['gift', 'follow', 'like', 'custom'];

export type ShapeKind = 'rose' | 'petal' | 'heart' | 'circle' | 'star' | 'sparkle' | 'confetti';
export const SHAPES: ShapeKind[] = ['rose', 'petal', 'heart', 'circle', 'star', 'sparkle', 'confetti'];

/**
 * How particles enter the screen.
 *  fountain – thrown up from the bottom, arc back down
 *  float    – rise gently from the bottom with sway (balloons)
 *  rain     – fall from the top
 *  burst    – explode outwards from the centre
 *  point    – spray upwards from a random spot in the lower right (TikTok-like taps)
 *  cannons  – fire from both bottom corners
 */
export type EmitterKind = 'fountain' | 'float' | 'rain' | 'burst' | 'point' | 'cannons';
export const EMITTERS: EmitterKind[] = ['fountain', 'float', 'rain', 'burst', 'point', 'cannons'];

/** User-configurable settings of one effect (dashboard + URL parameters). */
export interface EffectSettings {
  /** Total length of the effect in ms (particles + alert card). */
  duration: number;
  /** Number of particles in one play. */
  count: number;
  colors: string[];
  /** Base particle size in px. */
  size: number;
  shape: ShapeKind;
  emitter: EmitterKind;
  /** Alert text; {user} {gift} {count} {likes} {name}. Empty = no card. */
  message: string;
  /** Emoji shown on the alert card. */
  icon: string;
  /**
   * Which events trigger the effect.
   * gift: gift name ("Rose") or "*" · custom: event name ("share") or "*".
   * Ignored by follow and like.
   */
  filter: string;
}

/** One emission of particles, produced from settings by bursts.ts. */
export interface BurstConfig {
  shapes: ShapeKind[];
  colors: string[];
  count: number;
  size: number;
  emitter: EmitterKind;
  /** Lifetime of the burst in ms. */
  duration: number;
  /** Particles are spawned over this many ms (0 = all at once). */
  emitOver: number;
  /** Optional emitter position (0–1 of the stage) for 'burst' and 'point'. */
  origin?: { x: number; y: number };
  /** Optional wait before the burst starts, in ms (e.g. firework salvos). */
  delay?: number;
}
