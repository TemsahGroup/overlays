// Spotlight state for one stream — pure functions, no React, no storage.
//
// "Biggest gift" compares coin value (diamondCount × repeatCount) of final
// gift messages. If any gift arrives without a value, the comparison switches
// to the gift count of a combo, so coins and counts are never compared.

export const SPOTLIGHT_STATE_VERSION = 1;

export interface GiftEntry {
  name: string;
  giftName: string;
  count: number;
  /** Coin value of the whole combo, when known. */
  coins?: number;
  at: number;
}

export interface PersonEntry {
  name: string;
  at: number;
}

export interface SpotlightState {
  version: number;
  startedAt: number;
  /** 0 = no event yet in this stream. */
  lastEventAt: number;
  missingValue: boolean;
  lastGift?: GiftEntry;
  biggestGift?: GiftEntry;
  lastFollow?: PersonEntry;
  lastShare?: PersonEntry;
}

export function createSpotlight(now: number): SpotlightState {
  return { version: SPOTLIGHT_STATE_VERSION, startedAt: now, lastEventAt: 0, missingValue: false };
}

const size = (e: GiftEntry, byCount: boolean) => (byCount ? e.count : (e.coins ?? 0));

export function addGift(s: SpotlightState, gift: { name: string; giftName: string; repeatCount: number; diamondCount?: number }, now: number): SpotlightState {
  const count = Math.max(1, Math.floor(gift.repeatCount) || 1);
  const known = gift.diamondCount !== undefined && Number.isFinite(gift.diamondCount) && gift.diamondCount >= 0;
  const entry: GiftEntry = { name: gift.name.slice(0, 40), giftName: gift.giftName.slice(0, 60), count, coins: known ? Math.floor(gift.diamondCount!) * count : undefined, at: now };
  const missingValue = s.missingValue || !known;
  const biggest = !s.biggestGift || size(entry, missingValue) > size(s.biggestGift, missingValue) ? entry : s.biggestGift;
  return { ...s, lastEventAt: now, missingValue, lastGift: entry, biggestGift: biggest };
}

export function addPerson(s: SpotlightState, kind: 'follow' | 'share', name: string, now: number): SpotlightState {
  const entry = { name: name.slice(0, 40), at: now };
  return kind === 'follow' ? { ...s, lastEventAt: now, lastFollow: entry } : { ...s, lastEventAt: now, lastShare: entry };
}

/** A gap of `gapHours` without events is treated as a new stream. */
export function shouldStartNew(s: SpotlightState, now: number, gapHours: number): boolean {
  return s.lastEventAt > 0 && now - s.lastEventAt > gapHours * 3_600_000;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const name = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : null);

function gift(v: unknown): GiftEntry | undefined {
  if (!isObj(v) || !name(v.name) || !name(v.giftName)) return undefined;
  return { name: name(v.name)!, giftName: name(v.giftName)!, count: Math.max(1, n(v.count)), coins: typeof v.coins === 'number' ? n(v.coins) : undefined, at: n(v.at) };
}

function person(v: unknown): PersonEntry | undefined {
  return isObj(v) && name(v.name) ? { name: name(v.name)!, at: n(v.at) } : undefined;
}

export function sanitizeSpotlightState(raw: unknown, now: number): SpotlightState {
  if (!isObj(raw) || raw.version !== SPOTLIGHT_STATE_VERSION) return createSpotlight(now);
  return {
    version: SPOTLIGHT_STATE_VERSION,
    startedAt: n(raw.startedAt) || now,
    lastEventAt: n(raw.lastEventAt),
    missingValue: raw.missingValue === true,
    lastGift: gift(raw.lastGift),
    biggestGift: gift(raw.biggestGift),
    lastFollow: person(raw.lastFollow),
    lastShare: person(raw.lastShare),
  };
}
