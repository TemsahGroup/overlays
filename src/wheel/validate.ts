import { isValidId, newId } from '../builder/validate';
import { WHEEL_SCHEMA_VERSION, WHEEL_STYLES, type PublicWheelConfig, type WheelConfig, type WheelSegment, type WheelStyle } from './types';

export const WHEEL_LIMITS = {
  segments: { min: 2, max: 12 },
  label: 24,
  minCoins: { min: 1, max: 1_000_000 },
  spinSeconds: { min: 3, max: 10 },
} as const;

export const SEGMENT_COLORS = ['#fe2c55', '#ffd166', '#25f4ee', '#7c5cff', '#3ddc84', '#ff8fab', '#ff9f43', '#4cc9f0', '#b388ff', '#06d6a0', '#f783ac', '#74c0fc'];

export const PRESETS = {
  challenges: {
    en: ['🎤 Sing a song', '💪 10 push-ups', '😂 Tell a joke', '🔄 Spin again', '🎭 Do an accent', '❌ Better luck'],
    ar: ['🎤 غني أغنية', '💪 10 ضغط', '😂 قول نكتة', '🔄 لف تاني', '🎭 قلّد لهجة', '❌ حظ أوفر'],
  },
  prizes: {
    en: ['🎁 Shout-out', '⭐ Pick next game', '🎵 Choose a song', '👑 VIP for today', '🔄 Spin again', '❌ Nothing'],
    ar: ['🎁 شاوت أوت', '⭐ اختار اللعبة الجاية', '🎵 اختار أغنية', '👑 VIP النهارده', '🔄 لف تاني', '❌ ولا حاجة'],
  },
  yesno: {
    en: ['✅ Yes', '❌ No', '✅ Yes', '❌ No'],
    ar: ['✅ آه', '❌ لأ', '✅ آه', '❌ لأ'],
  },
} as const;
export type PresetKey = keyof typeof PRESETS;

export function presetSegments(key: PresetKey, lang: 'ar' | 'en'): WheelSegment[] {
  return PRESETS[key][lang].map((label, i) => ({ label, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }));
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX_RE = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export function sanitizeSegments(v: unknown): WheelSegment[] {
  const list = (Array.isArray(v) ? v : [])
    .filter(isObj)
    .slice(0, WHEEL_LIMITS.segments.max)
    .map((s, i) => ({
      label: str(s.label, `#${i + 1}`, WHEEL_LIMITS.label),
      color: typeof s.color === 'string' && HEX_RE.test(s.color) ? s.color : SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    }));
  return list.length >= WHEEL_LIMITS.segments.min ? list : presetSegments('challenges', 'en');
}

function sanitizeShared(v: Obj) {
  return {
    schemaVersion: WHEEL_SCHEMA_VERSION,
    name: str(v.name, 'Wheel of fortune', 60),
    style: (WHEEL_STYLES as string[]).includes(v.style as string) ? (v.style as WheelStyle) : 'classic',
    title: str(v.title, 'Wheel of fortune', 40),
    segments: sanitizeSegments(v.segments),
    trigger: v.trigger === 'coins' ? ('coins' as const) : ('gift' as const),
    giftName: str(v.giftName, 'Rose', 60),
    minCoins: num(v.minCoins, 100, WHEEL_LIMITS.minCoins.min, WHEEL_LIMITS.minCoins.max),
    spinEach: v.spinEach !== false,
    spinSeconds: num(v.spinSeconds, 5, WHEEL_LIMITS.spinSeconds.min, WHEEL_LIMITS.spinSeconds.max),
    hideWhenIdle: v.hideWhenIdle === true,
    enabled: v.enabled !== false,
  };
}

const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

export function sanitizeWheel(v: unknown): WheelConfig | null {
  if (!isObj(v) || !isValidId(v.id) || !isValidId(v.ownerId)) return null;
  return { ...sanitizeShared(v), id: v.id, ownerId: v.ownerId, createdAt: isoDate(v.createdAt), updatedAt: isoDate(v.updatedAt) };
}

export function sanitizePublicWheel(v: unknown): PublicWheelConfig | null {
  if (!isObj(v) || !isValidId(v.id)) return null;
  return { ...sanitizeShared(v), id: v.id };
}

export function toPublicWheel(c: WheelConfig): PublicWheelConfig {
  const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = c;
  return rest;
}

export function newWheel(ownerId: string): WheelConfig {
  const now = new Date().toISOString();
  return { ...sanitizeShared({}), id: newId(), ownerId, createdAt: now, updatedAt: now };
}
