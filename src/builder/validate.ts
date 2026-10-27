// Validation for configuration data coming from storage or URLs. Anything
// missing or invalid falls back to a safe default; nothing is trusted as-is.

import { BUILDER_EFFECTS, getBuilderEffect } from './effects';
import {
  MAX_MAPPINGS,
  SCHEMA_VERSION,
  type AlertSettings,
  type BuilderEffectId,
  type BuilderEffectSettings,
  type GiftMapping,
  type Intensity,
  type Layout,
  type OverlayConfig,
  type PublicOverlayConfig,
} from './types';

export const LIMITS = {
  count: { min: 1, max: 300 },
  duration: { min: 800, max: 12000 },
  size: { min: 8, max: 120 },
} as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string, max = 80) => (typeof v === 'string' ? v.slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id);
}

export function newId(): string {
  // crypto.randomUUID needs a secure context (https or localhost).
  const raw = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  return raw.replace(/-/g, '').slice(0, 20);
}

function sanitizeColors(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return [...fallback];
  const colors = v.filter((c): c is string => typeof c === 'string' && HEX_RE.test(c)).slice(0, 8);
  return colors.length ? colors : [...fallback];
}

export function sanitizeEffectSettings(v: unknown, effectId: BuilderEffectId): BuilderEffectSettings {
  const d = getBuilderEffect(effectId).defaults;
  const o = isObj(v) ? v : {};
  const intensity: Intensity = o.intensity === 'low' || o.intensity === 'high' ? o.intensity : 'medium';
  return {
    colors: sanitizeColors(o.colors, d.colors),
    count: num(o.count, d.count, LIMITS.count.min, LIMITS.count.max),
    duration: num(o.duration, d.duration, LIMITS.duration.min, LIMITS.duration.max),
    size: num(o.size, d.size, LIMITS.size.min, LIMITS.size.max),
    intensity,
    ...(d.emojis !== undefined ? { emojis: str(o.emojis, d.emojis, 60).trim() || d.emojis } : {}),
  };
}

export function sanitizeAlert(v: unknown): AlertSettings {
  const o = isObj(v) ? v : {};
  return {
    enabled: o.enabled !== false,
    text: str(o.text, '{user} sent {gift} ×{count}', 120),
    icon: str(o.icon, '🎁', 8),
  };
}

export function defaultMapping(giftName = 'Rose', giftId: string | null = null, effectId: BuilderEffectId = 'rose-rain'): GiftMapping {
  return {
    id: newId(),
    selectedGiftId: giftId,
    selectedGiftName: giftName,
    effectId,
    effectSettings: sanitizeEffectSettings({}, effectId),
    alertSettings: sanitizeAlert({}),
  };
}

function sanitizeMapping(v: unknown): GiftMapping | null {
  if (!isObj(v)) return null;
  const effectId = BUILDER_EFFECTS.some((e) => e.id === v.effectId) ? (v.effectId as BuilderEffectId) : 'rose-rain';
  const giftName = str(v.selectedGiftName, '', 60).trim();
  if (!giftName) return null;
  const giftId = typeof v.selectedGiftId === 'string' && /^[\w-]{1,32}$/.test(v.selectedGiftId) ? v.selectedGiftId : null;
  return {
    id: isValidId(v.id) ? v.id : newId(),
    selectedGiftId: giftId,
    selectedGiftName: giftName,
    effectId,
    effectSettings: sanitizeEffectSettings(v.effectSettings, effectId),
    alertSettings: sanitizeAlert(v.alertSettings),
  };
}

function sanitizeMappings(v: unknown): GiftMapping[] {
  const list = Array.isArray(v) ? v.map(sanitizeMapping).filter((m): m is GiftMapping => m !== null) : [];
  return list.length ? list.slice(0, MAX_MAPPINGS) : [defaultMapping()];
}

const layout = (v: unknown): Layout => (v === '9:16' ? '9:16' : '16:9');
const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

/** Full record from storage. Returns null when the id or owner is unusable. */
export function sanitizeConfig(v: unknown): OverlayConfig | null {
  if (!isObj(v) || !isValidId(v.id) || !isValidId(v.ownerId)) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: v.id,
    ownerId: v.ownerId,
    name: str(v.name, 'Untitled overlay', 60).trim() || 'Untitled overlay',
    layout: layout(v.layout),
    mappings: sanitizeMappings(v.mappings),
    enabled: v.enabled !== false,
    createdAt: isoDate(v.createdAt),
    updatedAt: isoDate(v.updatedAt),
  };
}

/** Public projection for overlays: drops ownerId and timestamps. */
export function toPublic(c: OverlayConfig): PublicOverlayConfig {
  return { schemaVersion: c.schemaVersion, id: c.id, name: c.name, layout: c.layout, mappings: c.mappings, enabled: c.enabled };
}

export function sanitizePublic(v: unknown): PublicOverlayConfig | null {
  if (!isObj(v) || !isValidId(v.id)) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: v.id,
    name: str(v.name, 'Overlay', 60),
    layout: layout(v.layout),
    mappings: sanitizeMappings(v.mappings),
    enabled: v.enabled !== false,
  };
}
