import { isValidId, newId } from '../builder/validate';
import {
  LEADERBOARD_SCHEMA_VERSION,
  LEADERBOARD_STYLES,
  type LeaderboardConfig,
  type LeaderboardKind,
  type LeaderboardStyle,
  type PublicLeaderboardConfig,
} from './types';

export const LB_LIMITS = {
  topN: { min: 3, max: 10 },
  sessionGapHours: { min: 1, max: 24 },
} as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX_RE = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export const KIND_DEFAULTS: Record<LeaderboardKind, { title: string; colors: [string, string] }> = {
  gifters: { title: 'Top Gifters', colors: ['#ffd166', '#fe2c55'] },
  likers: { title: 'Top Likers', colors: ['#fe2c55', '#25f4ee'] },
};

function sanitizeShared(v: Obj) {
  const kind: LeaderboardKind = v.kind === 'likers' ? 'likers' : 'gifters';
  const d = KIND_DEFAULTS[kind];
  const colors = Array.isArray(v.colors) ? v.colors : [];
  return {
    schemaVersion: LEADERBOARD_SCHEMA_VERSION,
    name: str(v.name, d.title, 60),
    kind,
    style: (LEADERBOARD_STYLES as string[]).includes(v.style as string) ? (v.style as LeaderboardStyle) : 'glass',
    title: str(v.title, d.title, 40),
    topN: num(v.topN, 5, LB_LIMITS.topN.min, LB_LIMITS.topN.max),
    colors: [
      typeof colors[0] === 'string' && HEX_RE.test(colors[0]) ? colors[0] : d.colors[0],
      typeof colors[1] === 'string' && HEX_RE.test(colors[1]) ? colors[1] : d.colors[1],
    ] as [string, string],
    sessionGapHours: num(v.sessionGapHours, 3, LB_LIMITS.sessionGapHours.min, LB_LIMITS.sessionGapHours.max),
    enabled: v.enabled !== false,
  };
}

const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

export function sanitizeLeaderboard(v: unknown): LeaderboardConfig | null {
  if (!isObj(v) || !isValidId(v.id) || !isValidId(v.ownerId)) return null;
  return { ...sanitizeShared(v), id: v.id, ownerId: v.ownerId, createdAt: isoDate(v.createdAt), updatedAt: isoDate(v.updatedAt) };
}

export function sanitizePublicLeaderboard(v: unknown): PublicLeaderboardConfig | null {
  if (!isObj(v) || !isValidId(v.id)) return null;
  return { ...sanitizeShared(v), id: v.id };
}

export function toPublicLeaderboard(c: LeaderboardConfig): PublicLeaderboardConfig {
  const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = c;
  return rest;
}

export function newLeaderboard(ownerId: string, kind: LeaderboardKind = 'gifters'): LeaderboardConfig {
  const now = new Date().toISOString();
  const d = KIND_DEFAULTS[kind];
  return {
    schemaVersion: LEADERBOARD_SCHEMA_VERSION,
    id: newId(),
    ownerId,
    name: d.title,
    kind,
    style: 'glass',
    title: d.title,
    topN: 5,
    colors: [...d.colors] as [string, string],
    sessionGapHours: 3,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}
