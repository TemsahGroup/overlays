import { isValidId, newId } from '../builder/validate';
import { GOAL_METRICS, GOAL_SCHEMA_VERSION, GOAL_STYLES, type GoalConfig, type GoalMetric, type GoalStyle, type PublicGoalConfig } from './types';

export const GOAL_LIMITS = {
  target: { min: 1, max: 100_000_000 },
  sessionGapHours: { min: 1, max: 24 },
} as const;

export const METRIC_DEFAULTS: Record<GoalMetric, { title: string; target: number; colors: [string, string] }> = {
  coins: { title: 'Coin goal', target: 1000, colors: ['#ffd166', '#fe2c55'] },
  likes: { title: 'Like goal', target: 10000, colors: ['#fe2c55', '#ff8fab'] },
  follows: { title: 'Follow goal', target: 100, colors: ['#25f4ee', '#7c5cff'] },
  shares: { title: 'Share goal', target: 50, colors: ['#3ddc84', '#25f4ee'] },
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX_RE = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

function sanitizeShared(v: Obj) {
  const metric: GoalMetric = (GOAL_METRICS as string[]).includes(v.metric as string) ? (v.metric as GoalMetric) : 'coins';
  const d = METRIC_DEFAULTS[metric];
  const colors = Array.isArray(v.colors) ? v.colors : [];
  return {
    schemaVersion: GOAL_SCHEMA_VERSION,
    name: str(v.name, d.title, 60),
    metric,
    style: (GOAL_STYLES as string[]).includes(v.style as string) ? (v.style as GoalStyle) : 'classic',
    title: str(v.title, d.title, 40),
    target: num(v.target, d.target, GOAL_LIMITS.target.min, GOAL_LIMITS.target.max),
    autoNext: v.autoNext === true,
    colors: [
      typeof colors[0] === 'string' && HEX_RE.test(colors[0]) ? colors[0] : d.colors[0],
      typeof colors[1] === 'string' && HEX_RE.test(colors[1]) ? colors[1] : d.colors[1],
    ] as [string, string],
    sessionGapHours: num(v.sessionGapHours, 3, GOAL_LIMITS.sessionGapHours.min, GOAL_LIMITS.sessionGapHours.max),
    enabled: v.enabled !== false,
  };
}

const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

export function sanitizeGoal(v: unknown): GoalConfig | null {
  if (!isObj(v) || !isValidId(v.id) || !isValidId(v.ownerId)) return null;
  return { ...sanitizeShared(v), id: v.id, ownerId: v.ownerId, createdAt: isoDate(v.createdAt), updatedAt: isoDate(v.updatedAt) };
}

export function sanitizePublicGoal(v: unknown): PublicGoalConfig | null {
  if (!isObj(v) || !isValidId(v.id)) return null;
  return { ...sanitizeShared(v), id: v.id };
}

export function toPublicGoal(c: GoalConfig): PublicGoalConfig {
  const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = c;
  return rest;
}

export function newGoal(ownerId: string, metric: GoalMetric = 'coins'): GoalConfig {
  const now = new Date().toISOString();
  return { ...sanitizeShared({ metric }), id: newId(), ownerId, createdAt: now, updatedAt: now };
}
