import { isValidId, newId } from '../builder/validate';
import { CHAT_SCHEMA_VERSION, CHAT_STYLES, type ChatConfig, type ChatStyle, type PublicChatConfig } from './types';

export const CHAT_LIMITS = {
  maxMessages: { min: 3, max: 20 },
  fadeSeconds: { min: 0, max: 300 },
  textScale: { min: 70, max: 160 },
  blockedWords: { count: 50, length: 30 },
} as const;

export const CHAT_DEFAULTS = { title: 'Live chat', colors: ['#7c5cff', '#25f4ee'] as [string, string] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const HEX_RE = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, fallback: string, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** Trims, lower-cases, drops empties and duplicates, and caps count and length. */
export function cleanWords(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const w of v) {
    if (typeof w !== 'string') continue;
    const word = w.trim().toLowerCase().slice(0, CHAT_LIMITS.blockedWords.length);
    if (word && !out.includes(word)) out.push(word);
    if (out.length >= CHAT_LIMITS.blockedWords.count) break;
  }
  return out;
}

function sanitizeShared(v: Obj) {
  const colors = Array.isArray(v.colors) ? v.colors : [];
  return {
    schemaVersion: CHAT_SCHEMA_VERSION,
    name: str(v.name, CHAT_DEFAULTS.title, 60),
    style: (CHAT_STYLES as string[]).includes(v.style as string) ? (v.style as ChatStyle) : 'bubbles',
    maxMessages: num(v.maxMessages, 8, CHAT_LIMITS.maxMessages.min, CHAT_LIMITS.maxMessages.max),
    fadeSeconds: num(v.fadeSeconds, 0, CHAT_LIMITS.fadeSeconds.min, CHAT_LIMITS.fadeSeconds.max),
    textScale: num(v.textScale, 100, CHAT_LIMITS.textScale.min, CHAT_LIMITS.textScale.max),
    colors: [
      typeof colors[0] === 'string' && HEX_RE.test(colors[0]) ? colors[0] : CHAT_DEFAULTS.colors[0],
      typeof colors[1] === 'string' && HEX_RE.test(colors[1]) ? colors[1] : CHAT_DEFAULTS.colors[1],
    ] as [string, string],
    showAvatars: v.showAvatars !== false,
    showGifts: v.showGifts !== false,
    hideCommands: v.hideCommands !== false,
    blockedWords: cleanWords(v.blockedWords),
    enabled: v.enabled !== false,
  };
}

const isoDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

export function sanitizeChat(v: unknown): ChatConfig | null {
  if (!isObj(v) || !isValidId(v.id) || !isValidId(v.ownerId)) return null;
  return { ...sanitizeShared(v), id: v.id, ownerId: v.ownerId, createdAt: isoDate(v.createdAt), updatedAt: isoDate(v.updatedAt) };
}

export function sanitizePublicChat(v: unknown): PublicChatConfig | null {
  if (!isObj(v) || !isValidId(v.id)) return null;
  return { ...sanitizeShared(v), id: v.id };
}

export function toPublicChat(c: ChatConfig): PublicChatConfig {
  const { ownerId: _o, createdAt: _c, updatedAt: _u, ...rest } = c;
  return rest;
}

export function newChat(ownerId: string): ChatConfig {
  const now = new Date().toISOString();
  return { ...sanitizeShared({}), id: newId(), ownerId, createdAt: now, updatedAt: now };
}
