import { isValidId, newId } from '../builder/validate';
import { TIMER_SCHEMA_VERSION, TIMER_STYLES, type PublicTimerConfig, type TimerConfig, type TimerRules, type TimerStyle } from './types';

export const TIMER_LIMITS = {
  startMinutes: { min: 1, max: 24 * 60 },
  perRule: { min: 0, max: 3600 },
  maxHours: { min: 0, max: 72 },
  sessionGapHours: { min: 1, max: 24 },
} as const;

export const TIMER_DEFAULTS = {
  title: 'Gift timer',
  colors: ['#25f4ee', '#fe2c55'] as [string, string],
  rules: { perCoin: 10, perFollow: 30, perShare: 15, per100Likes: 0 } as TimerRules,
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX_RE = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

function sanitizeRules(v: unknown): TimerRules {
  const o = isObj(v) ? v : {};
  const d = TIMER_DEFAULTS.rules;
  const { min, max } = TIMER_LIMITS.perRule;
  return {
    perCoin: num(o.perCoin, d.perCoin, min, max),
    perFollow: num(o.perFollow, d.perFollow, min, max),
    perShare: num(o.perShare, d.perShare, min, max),
    per100Likes: num(o.per100Likes, d.per100Likes, min, max),
  };
}

function sanitizeShared(v: Obj) {
  const colors = Array.isArray(v.colors) ? v.colors : [];
  return {
    schemaVersion: TIMER_SCHEMA_VERSION,
    name: str(v.name, TIMER_DEFAULTS.title, 60),
    style: (TIMER_STYLES as string[]).includes(v.style as string) ? (v.style as TimerStyle) : 'digital',
    title: str(v.title, TIMER_DEFAULTS.title, 40),
    startMinutes: num(v.startMinutes, 60, TIMER_LIMITS.startMinutes.min, TIMER_LIMITS.startMinutes.max),
    rules: sanitizeRules(v.rules),
    maxHours: num(v.maxHours, 0, TIMER_LIMITS.maxHours.min, TIMER_LIMITS.maxHours.max),
    autoStart: v.autoStart !== false,
    showAdds: v.showAdds !== false,
    showRules: v.showRules !== false,
    colors: [
      typeof colors[0] === 'string' && HEX_RE.test(colors[0]) ? colors[0] : TIMER_DEFAULTS.colors[0],
      typeof colors[1] === 'string' && HEX_RE.test(colors[1]) ? colors[1] : TIMER_DEFAULTS.colors[1],
    ] as [string, string],
    sessionGapHours: num(v.sessionGapHours, 3, TIMER_LIMITS.sessionGapHours.min, TIMER_LIMITS.sessionGapHours.max),
    enabled: v.enabled !== false,
  };
}

const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

export function sanitizeTimer(v: unknown): TimerConfig | null {
  if (!isObj(v) || !isValidId(v.id) || !isValidId(v.ownerId)) return null;
  return { ...sanitizeShared(v), id: v.id, ownerId: v.ownerId, createdAt: isoDate(v.createdAt), updatedAt: isoDate(v.updatedAt) };
}

export function sanitizePublicTimer(v: unknown): PublicTimerConfig | null {
  if (!isObj(v) || !isValidId(v.id)) return null;
  return { ...sanitizeShared(v), id: v.id };
}

export function toPublicTimer(c: TimerConfig): PublicTimerConfig {
  const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = c;
  return rest;
}

export function newTimer(ownerId: string): TimerConfig {
  const now = new Date().toISOString();
  return { ...sanitizeShared({}), id: newId(), ownerId, createdAt: now, updatedAt: now };
}
