import { isValidId, newId } from '../builder/validate';
import {
  SPOTLIGHT_ITEMS,
  SPOTLIGHT_SCHEMA_VERSION,
  SPOTLIGHT_STYLES,
  type PublicSpotlightConfig,
  type SpotlightConfig,
  type SpotlightItem,
  type SpotlightStyle,
} from './types';

export const SPOTLIGHT_LIMITS = {
  rotateSeconds: { min: 3, max: 30 },
  sessionGapHours: { min: 1, max: 24 },
} as const;

export const SPOTLIGHT_DEFAULTS = { title: 'Spotlight', colors: ['#ffd166', '#fe2c55'] as [string, string], items: ['lastGift', 'biggestGift'] as SpotlightItem[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX_RE = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** Known items only, no duplicates, in the given order; never empty. */
export function sanitizeItems(v: unknown): SpotlightItem[] {
  const out: SpotlightItem[] = [];
  for (const x of Array.isArray(v) ? v : []) if ((SPOTLIGHT_ITEMS as unknown[]).includes(x) && !out.includes(x as SpotlightItem)) out.push(x as SpotlightItem);
  return out.length ? out : [...SPOTLIGHT_DEFAULTS.items];
}

function sanitizeShared(v: Obj) {
  const colors = Array.isArray(v.colors) ? v.colors : [];
  return {
    schemaVersion: SPOTLIGHT_SCHEMA_VERSION,
    name: str(v.name, SPOTLIGHT_DEFAULTS.title, 60),
    style: (SPOTLIGHT_STYLES as string[]).includes(v.style as string) ? (v.style as SpotlightStyle) : 'pill',
    items: sanitizeItems(v.items),
    layout: v.layout === 'rotate' ? ('rotate' as const) : ('stack' as const),
    rotateSeconds: num(v.rotateSeconds, 6, SPOTLIGHT_LIMITS.rotateSeconds.min, SPOTLIGHT_LIMITS.rotateSeconds.max),
    colors: [
      typeof colors[0] === 'string' && HEX_RE.test(colors[0]) ? colors[0] : SPOTLIGHT_DEFAULTS.colors[0],
      typeof colors[1] === 'string' && HEX_RE.test(colors[1]) ? colors[1] : SPOTLIGHT_DEFAULTS.colors[1],
    ] as [string, string],
    sessionGapHours: num(v.sessionGapHours, 3, SPOTLIGHT_LIMITS.sessionGapHours.min, SPOTLIGHT_LIMITS.sessionGapHours.max),
    enabled: v.enabled !== false,
  };
}

const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

export function sanitizeSpotlight(v: unknown): SpotlightConfig | null {
  if (!isObj(v) || !isValidId(v.id) || !isValidId(v.ownerId)) return null;
  return { ...sanitizeShared(v), id: v.id, ownerId: v.ownerId, createdAt: isoDate(v.createdAt), updatedAt: isoDate(v.updatedAt) };
}

export function sanitizePublicSpotlight(v: unknown): PublicSpotlightConfig | null {
  if (!isObj(v) || !isValidId(v.id)) return null;
  return { ...sanitizeShared(v), id: v.id };
}

export function toPublicSpotlight(c: SpotlightConfig): PublicSpotlightConfig {
  const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = c;
  return rest;
}

export function newSpotlight(ownerId: string): SpotlightConfig {
  const now = new Date().toISOString();
  return { ...sanitizeShared({}), id: newId(), ownerId, createdAt: now, updatedAt: now };
}
