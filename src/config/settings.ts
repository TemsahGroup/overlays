// Snow settings + URL parameter parsing.
// Every setting can be supplied as a query parameter, e.g.
//   /?overlay=1&density=300&speed=1.2&size=1.5&wind=0.4

export interface SnowSettings {
  /** Flakes per 1920×1080 area. Scales with the actual canvas size. */
  density: number;
  /** Fall speed multiplier. */
  speed: number;
  /** Flake size multiplier. */
  size: number;
  /** Constant horizontal wind (-2 = strong left, 2 = strong right). */
  wind: number;
}

export interface AppConfig {
  /** true = clean overlay-only mode (no controls, no pointer events). */
  overlay: boolean;
  snow: SnowSettings;
}

export const DEFAULT_SNOW: SnowSettings = {
  density: 260,
  speed: 1,
  size: 1,
  wind: 0.2,
};

/** Slider/URL bounds; values outside are clamped. */
export const SNOW_LIMITS: Record<keyof SnowSettings, { min: number; max: number; step: number }> = {
  density: { min: 0, max: 1200, step: 10 },
  speed: { min: 0.1, max: 4, step: 0.1 },
  size: { min: 0.3, max: 3, step: 0.1 },
  wind: { min: -2, max: 2, step: 0.1 },
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function readNumber(params: URLSearchParams, key: keyof SnowSettings): number {
  const raw = params.get(key);
  const value = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_SNOW[key];
  const { min, max } = SNOW_LIMITS[key];
  return clamp(value, min, max);
}

function readBool(params: URLSearchParams, key: string): boolean {
  const raw = params.get(key);
  return raw !== null && raw !== '0' && raw.toLowerCase() !== 'false';
}

export function parseConfig(search: string = window.location.search): AppConfig {
  const params = new URLSearchParams(search);
  return {
    overlay: readBool(params, 'overlay'),
    snow: {
      density: readNumber(params, 'density'),
      speed: readNumber(params, 'speed'),
      size: readNumber(params, 'size'),
      wind: readNumber(params, 'wind'),
    },
  };
}

/** Builds a query string for the given settings (only non-default values). */
export function buildQuery(snow: SnowSettings, overlay: boolean): string {
  const params = new URLSearchParams();
  if (overlay) params.set('overlay', '1');
  (Object.keys(snow) as (keyof SnowSettings)[]).forEach((key) => {
    if (snow[key] !== DEFAULT_SNOW[key]) params.set(key, String(snow[key]));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
