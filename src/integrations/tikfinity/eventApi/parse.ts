// Pure parsing for TikFinity Event API messages. No I/O, fully unit-tested.
//
// What is documented (https://tikfinity.zerody.one/tiktok/dapi, checked 2026-10-26):
//   • envelope: { "event": "<name>", "data": { … } }
//   • event names: chat, gift, share, follow, like, roomUser, subscribe
//   • `data` follows the TikTok-Live-Connector event structures.
//
// TikTok-Live-Connector documents two gift layouts and TikFinity does not say
// which one it forwards, so both are accepted — but only through the field
// paths listed below, each checked at runtime. Anything else is reported as
// "unrecognized" in diagnostics and never played.
//
//   field        v1 (flat, README v1.x)        v2 (nested, ttlc docs)
//   gift id      data.giftId                   data.giftId
//   gift name    data.giftName                 data.gift.name
//   gift type    data.giftType                 data.gift.type
//   repeat count data.repeatCount              data.repeatCount
//   streak end   data.repeatEnd (boolean)      data.repeatEnd (1)
//   user         data.uniqueId                 data.user.uniqueId | data.user.displayId
//   nickname     data.nickname                 —
//   message id   data.msgId                    —
//   coin value   data.diamondCount             —   (meaning undocumented; assumed per gift, verify)
//
// Like events (v1 README; v2 documents likeCount and user only):
//   likes        data.likeCount (this message's taps)
//   user         data.uniqueId | data.user.uniqueId | data.user.displayId
//   nickname     data.nickname
//   message id   data.msgId
// TikTok-Live-Connector notes that for busy streams TikTok does not always
// send like events, so like totals are approximate.
//
// Streak rule (both docs): giftType 1 gifts are sent repeatedly with a rising
// repeatCount while the streak runs; only the message with repeatEnd set is
// final. Other gift types are final immediately.

export const DOCUMENTED_EVENTS = ['chat', 'gift', 'share', 'follow', 'like', 'roomUser', 'subscribe'] as const;
export const MAX_MESSAGE_BYTES = 256 * 1024;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export type ParsedMessage =
  | { kind: 'malformed'; reason: string }
  | { kind: 'event'; event: string; known: boolean; data: Obj };

export function parseMessage(raw: unknown): ParsedMessage {
  if (typeof raw !== 'string') return { kind: 'malformed', reason: 'non-text frame' };
  if (raw.length > MAX_MESSAGE_BYTES) return { kind: 'malformed', reason: 'message too large' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: 'malformed', reason: 'invalid JSON' };
  }
  if (!isObj(json)) return { kind: 'malformed', reason: 'not a JSON object' };
  if (typeof json.event !== 'string' || !json.event) return { kind: 'malformed', reason: 'missing "event" string' };
  if (!isObj(json.data)) return { kind: 'malformed', reason: 'missing "data" object' };
  const event = json.event.slice(0, 64);
  return { kind: 'event', event, known: (DOCUMENTED_EVENTS as readonly string[]).includes(event), data: json.data };
}

export type GiftLayout = 'v1-flat' | 'v2-nested' | 'unknown';

export interface GiftFields {
  giftId?: string;
  giftName?: string;
  giftType?: number;
  repeatCount?: number;
  repeatEnd?: boolean;
  username?: string;
  nickname?: string;
  msgId?: string;
  /** v1 `diamondCount`; assumed to be the value of ONE gift (to verify with real data). */
  diamondCount?: number;
}

export interface GiftExtraction {
  status: 'final' | 'streak-in-progress' | 'unrecognized';
  layout: GiftLayout;
  fields: GiftFields;
  /** Documented paths that were absent or had an unexpected type. */
  missing: string[];
}

const text = (v: unknown, max = 80): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
const idText = (v: unknown): string | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? String(v) : typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : undefined;
const int = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined;

export function extractGift(data: Obj): GiftExtraction {
  const gift = isObj(data.gift) ? data.gift : null;
  const user = isObj(data.user) ? data.user : null;
  const layout: GiftLayout =
    typeof data.giftName === 'string' || typeof data.uniqueId === 'string'
      ? 'v1-flat'
      : gift || user
        ? 'v2-nested'
        : 'unknown';

  const repeatEndRaw = data.repeatEnd;
  const fields: GiftFields = {
    giftId: idText(data.giftId),
    giftName: text(data.giftName) ?? text(gift?.name),
    giftType: int(data.giftType) ?? int(gift?.type),
    repeatCount: int(data.repeatCount),
    repeatEnd: repeatEndRaw === true || repeatEndRaw === 1 ? true : repeatEndRaw === false || repeatEndRaw === 0 ? false : undefined,
    username: text(data.uniqueId, 64) ?? text(user?.uniqueId, 64) ?? text(user?.displayId, 64),
    nickname: text(data.nickname, 64),
    msgId: idText(data.msgId),
    diamondCount: int(data.diamondCount),
  };

  const missing: string[] = [];
  if (!fields.giftId) missing.push('giftId');
  if (!fields.giftName) missing.push(layout === 'v2-nested' ? 'gift.name' : 'giftName');
  if (fields.giftType === undefined) missing.push(layout === 'v2-nested' ? 'gift.type' : 'giftType');
  if (fields.repeatCount === undefined) missing.push('repeatCount');
  if (fields.repeatEnd === undefined) missing.push('repeatEnd');
  if (!fields.username) missing.push(layout === 'v2-nested' ? 'user.uniqueId' : 'uniqueId');
  if (fields.diamondCount === undefined) missing.push('diamondCount');

  if (!fields.giftId && !fields.giftName) return { status: 'unrecognized', layout, fields, missing };
  const inStreak = fields.giftType === 1 && fields.repeatEnd !== true;
  return { status: inStreak ? 'streak-in-progress' : 'final', layout, fields, missing };
}

export interface LikeFields {
  likeCount?: number;
  username?: string;
  nickname?: string;
  msgId?: string;
}

export interface LikeExtraction {
  status: 'final' | 'unrecognized';
  fields: LikeFields;
  missing: string[];
}

export function extractLike(data: Obj): LikeExtraction {
  const user = isObj(data.user) ? data.user : null;
  const likeCount = int(data.likeCount);
  const fields: LikeFields = {
    likeCount: likeCount && likeCount > 0 ? likeCount : undefined,
    username: text(data.uniqueId, 64) ?? text(user?.uniqueId, 64) ?? text(user?.displayId, 64),
    nickname: text(data.nickname, 64),
    msgId: idText(data.msgId),
  };
  const missing: string[] = [];
  if (!fields.likeCount) missing.push('likeCount');
  if (!fields.username) missing.push(user ? 'user.uniqueId' : 'uniqueId');
  // Without a positive count or a user there is nothing to attribute.
  const ok = fields.likeCount !== undefined && fields.username !== undefined;
  return { status: ok ? 'final' : 'unrecognized', fields, missing };
}

/**
 * Structure of a payload with all values removed (types and array lengths
 * only) — safe to show in diagnostics without leaking usernames or messages.
 */
export function describeShape(value: unknown, depth = 0): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) return depth >= 4 ? `array(${value.length})` : [`array(${value.length})`, value.length ? describeShape(value[0], depth + 1) : 'empty'];
  if (isObj(value)) {
    if (depth >= 4) return 'object';
    const out: Obj = {};
    Object.keys(value).slice(0, 60).forEach((k) => {
      out[k.slice(0, 40)] = describeShape(value[k], depth + 1);
    });
    return out;
  }
  if (typeof value === 'string') return `string(${value.length})`;
  return typeof value;
}

/** "zerodytester" → "z***r" for on-screen diagnostics. */
export function maskUser(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return name.length <= 2 ? `${name[0]}*` : `${name[0]}***${name[name.length - 1]}`;
}

/** Only loopback WebSocket URLs are accepted as an override. */
export function isLoopbackWsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'ws:' || u.protocol === 'wss:') && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}
