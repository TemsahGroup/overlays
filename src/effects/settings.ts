// Defaults for each effect + reading/writing them as URL parameters.
//
// Single effect:   ?overlay=1&effect=like&count=80&colors=ff2d55,25f4ee&size=30
// Several effects: ?overlay=1&effect=gift,follow&gift.count=40&follow.duration=5000
// (prefixed "id.key" always works; un-prefixed keys apply when one effect is selected)

import { EFFECT_IDS, EMITTERS, SHAPES, type EffectId, type EffectSettings } from './types';

export const DEFAULT_SETTINGS: Record<EffectId, EffectSettings> = {
  gift: {
    duration: 4500,
    count: 26,
    colors: ['#ff2d55', '#ff6b8b', '#c9184a', '#ffb3c6'],
    size: 46,
    shape: 'rose',
    emitter: 'fountain',
    message: '{user} sent {gift} ×{count}',
    icon: '🌹',
    filter: 'Rose',
  },
  follow: {
    duration: 4200,
    count: 26,
    colors: ['#ff4d8d', '#ff8fb1', '#fe2c55', '#ffd1e0'],
    size: 40,
    shape: 'heart',
    emitter: 'float',
    message: 'Welcome, {user}! Thanks for the follow',
    icon: '💖',
    filter: '*',
  },
  like: {
    duration: 1900,
    count: 40,
    colors: ['#fe2c55', '#25f4ee', '#ffffff', '#ffd166'],
    size: 22,
    shape: 'heart',
    emitter: 'point',
    message: '{user} sent {likes} likes',
    icon: '👍',
    filter: '*',
  },
  custom: {
    duration: 3600,
    count: 70,
    colors: ['#7c5cff', '#25f4ee', '#ffd166', '#ff5fd2'],
    size: 24,
    shape: 'star',
    emitter: 'burst',
    message: '{user} triggered {name}!',
    icon: '✨',
    filter: '*',
  },
};

export const LIMITS = {
  duration: { min: 600, max: 15000, step: 100 },
  count: { min: 1, max: 400, step: 1 },
  size: { min: 6, max: 140, step: 1 },
} as const;

export const EFFECT_LABELS: Record<EffectId, string> = {
  gift: 'Gift Alert',
  follow: 'Follow Alert',
  like: 'Like Alert',
  custom: 'Custom Effect',
};

export function cloneDefaults(): Record<EffectId, EffectSettings> {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function parseColors(raw: string): string[] | null {
  const colors = raw
    .split(',')
    .map((c) => c.trim().replace(/^#?/, '#'))
    .filter((c) => /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c));
  return colors.length ? colors.slice(0, 8) : null;
}

function applyParam(s: EffectSettings, key: string, raw: string): void {
  switch (key) {
    case 'duration':
    case 'count':
    case 'size': {
      const n = Number(raw);
      if (Number.isFinite(n)) s[key] = clamp(Math.round(n), LIMITS[key].min, LIMITS[key].max);
      break;
    }
    case 'colors': {
      const colors = parseColors(raw);
      if (colors) s.colors = colors;
      break;
    }
    case 'shape':
      if ((SHAPES as string[]).includes(raw)) s.shape = raw as EffectSettings['shape'];
      break;
    case 'emitter':
      if ((EMITTERS as string[]).includes(raw)) s.emitter = raw as EffectSettings['emitter'];
      break;
    case 'message':
      s.message = raw.slice(0, 120);
      break;
    case 'icon':
      s.icon = raw.slice(0, 8);
      break;
    case 'filter':
      s.filter = raw.slice(0, 40) || '*';
      break;
  }
}

/** Parses `effect=` into the list of active effects. */
export function parseEffectList(raw: string | null): EffectId[] {
  if (!raw || raw === 'all') return [...EFFECT_IDS];
  const ids = raw.split(',').filter((id): id is EffectId => (EFFECT_IDS as string[]).includes(id));
  return ids.length ? ids : [...EFFECT_IDS];
}

export function parseSettings(params: URLSearchParams, active: EffectId[]): Record<EffectId, EffectSettings> {
  const settings = cloneDefaults();
  const single = active.length === 1 ? active[0] : null;
  params.forEach((value, fullKey) => {
    const [maybeId, maybeKey] = fullKey.split('.');
    if (maybeKey && (EFFECT_IDS as string[]).includes(maybeId)) {
      applyParam(settings[maybeId as EffectId], maybeKey, value);
    } else if (single && !maybeKey) {
      applyParam(settings[single], fullKey, value);
    }
  });
  return settings;
}

/** Builds query parameters for one effect, only for values that differ from the defaults. */
export function settingsToParams(id: EffectId, s: EffectSettings, prefix: boolean): URLSearchParams {
  const d = DEFAULT_SETTINGS[id];
  const p = new URLSearchParams();
  const key = (k: string) => (prefix ? `${id}.${k}` : k);
  (['duration', 'count', 'size', 'shape', 'emitter', 'message', 'icon', 'filter'] as const).forEach((k) => {
    if (s[k] !== d[k]) p.set(key(k), String(s[k]));
  });
  if (s.colors.join() !== d.colors.join()) p.set(key('colors'), s.colors.map((c) => c.replace('#', '')).join(','));
  return p;
}
