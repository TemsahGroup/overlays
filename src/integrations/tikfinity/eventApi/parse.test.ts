import { describe, expect, it } from 'vitest';
import { describeShape, extractChat, extractGift, extractLike, isLoopbackWsUrl, maskUser, parseMessage } from './parse';

// Fixtures follow the field names documented by TikTok-Live-Connector (which
// TikFinity's Event API page references). They are NOT captured TikFinity
// traffic — see README "What was verified".
const v1Gift = {
  giftId: 5655,
  repeatCount: 3,
  repeatEnd: true,
  msgId: '7137749190944230150',
  giftType: 1,
  giftName: 'Rose',
  uniqueId: 'zerodytester',
  nickname: 'Zerody Tester',
  diamondCount: 1,
};
const v2Gift = {
  giftId: 5655,
  repeatCount: 2,
  repeatEnd: 1,
  gift: { name: 'Rose', type: 1 },
  user: { uniqueId: 'zerodytester' },
};
const envelope = (event: string, data: unknown) => JSON.stringify({ event, data });

describe('parseMessage', () => {
  it.each([
    ['{not json', 'invalid JSON'],
    ['', 'invalid JSON'],
    ['[1,2]', 'not a JSON object'],
    ['"gift"', 'not a JSON object'],
    ['null', 'not a JSON object'],
    ['{"data":{}}', 'missing "event" string'],
    ['{"event":42,"data":{}}', 'missing "event" string'],
    ['{"event":"gift"}', 'missing "data" object'],
    ['{"event":"gift","data":"x"}', 'missing "data" object'],
  ])('rejects malformed message %j', (raw, reason) => {
    expect(parseMessage(raw)).toEqual({ kind: 'malformed', reason });
  });

  it('rejects binary frames and oversized messages', () => {
    expect(parseMessage(new ArrayBuffer(4))).toMatchObject({ kind: 'malformed', reason: 'non-text frame' });
    expect(parseMessage('x'.repeat(300_000))).toMatchObject({ kind: 'malformed', reason: 'message too large' });
  });

  it('accepts documented event names', () => {
    for (const name of ['chat', 'gift', 'share', 'follow', 'like', 'roomUser', 'subscribe']) {
      expect(parseMessage(envelope(name, {}))).toMatchObject({ kind: 'event', event: name, known: true });
    }
  });

  it('flags unknown event types instead of guessing', () => {
    expect(parseMessage(envelope('superGift', { giftName: 'Rose' }))).toMatchObject({ kind: 'event', event: 'superGift', known: false });
  });
});

describe('extractGift', () => {
  it('reads the documented v1 flat layout', () => {
    const x = extractGift(v1Gift);
    expect(x.status).toBe('final');
    expect(x.layout).toBe('v1-flat');
    expect(x.fields).toEqual({
      giftId: '5655',
      giftName: 'Rose',
      giftType: 1,
      repeatCount: 3,
      repeatEnd: true,
      username: 'zerodytester',
      nickname: 'Zerody Tester',
      msgId: '7137749190944230150',
      diamondCount: 1,
    });
    expect(x.missing).toEqual([]);
  });

  it('reads the documented v2 nested layout', () => {
    const x = extractGift(v2Gift);
    expect(x.status).toBe('final');
    expect(x.layout).toBe('v2-nested');
    expect(x.fields).toMatchObject({ giftId: '5655', giftName: 'Rose', giftType: 1, repeatCount: 2, repeatEnd: true, username: 'zerodytester' });
    expect(x.fields.msgId).toBeUndefined();
  });

  it('treats a running streak (giftType 1, not ended) as in progress', () => {
    expect(extractGift({ ...v1Gift, repeatEnd: false }).status).toBe('streak-in-progress');
    expect(extractGift({ ...v2Gift, repeatEnd: 0 }).status).toBe('streak-in-progress');
  });

  it('treats non-streakable gift types as final immediately', () => {
    expect(extractGift({ ...v1Gift, giftType: 2, repeatEnd: false }).status).toBe('final');
  });

  it('refuses payloads without a gift name or id', () => {
    const x = extractGift({ uniqueId: 'someone', repeatCount: 1 });
    expect(x.status).toBe('unrecognized');
    expect(x.missing).toEqual(expect.arrayContaining(['giftId', 'giftName']));
  });

  it('ignores fields with unexpected types rather than coercing them', () => {
    const x = extractGift({ giftName: { evil: true }, giftId: 'id with spaces!', repeatCount: -4, giftType: '1', uniqueId: 7 });
    expect(x.status).toBe('unrecognized');
    expect(x.fields).toEqual({ giftId: undefined, giftName: undefined, giftType: undefined, repeatCount: undefined, repeatEnd: undefined, username: undefined, nickname: undefined, msgId: undefined, diamondCount: undefined });
  });
});

describe('extractGift diamondCount', () => {
  it('reads a documented integer value and flags it when absent', () => {
    expect(extractGift({ ...v1Gift, diamondCount: 25 }).fields.diamondCount).toBe(25);
    const noValue = extractGift({ ...v1Gift, diamondCount: undefined });
    expect(noValue.fields.diamondCount).toBeUndefined();
    expect(noValue.missing).toContain('diamondCount');
    expect(extractGift({ ...v1Gift, diamondCount: '25' }).fields.diamondCount).toBeUndefined();
  });
});

describe('extractLike', () => {
  it('reads the documented v1 like fields', () => {
    const x = extractLike({ likeCount: 15, totalLikeCount: 900, uniqueId: 'viewer1', nickname: 'Viewer One', msgId: '77' });
    expect(x).toEqual({ status: 'final', fields: { likeCount: 15, username: 'viewer1', nickname: 'Viewer One', msgId: '77' }, missing: [] });
  });

  it('reads the v2 nested user', () => {
    expect(extractLike({ likeCount: 3, user: { uniqueId: 'v2user' } }).fields.username).toBe('v2user');
  });

  it.each([
    [{ uniqueId: 'a' }, 'likeCount'],
    [{ likeCount: 0, uniqueId: 'a' }, 'likeCount'],
    [{ likeCount: '5', uniqueId: 'a' }, 'likeCount'],
    [{ likeCount: 5 }, 'uniqueId'],
  ])('refuses %j (missing %s)', (data, missing) => {
    const x = extractLike(data as Record<string, unknown>);
    expect(x.status).toBe('unrecognized');
    expect(x.missing).toContain(missing);
  });
});

describe('diagnostic helpers', () => {
  it('describeShape keeps structure and drops values', () => {
    const shape = JSON.stringify(describeShape({ ...v1Gift, extra: [{ a: 'secret' }] }));
    expect(shape).not.toContain('zerodytester');
    expect(shape).not.toContain('secret');
    expect(shape).toContain('"giftName":"string(4)"');
    expect(shape).toContain('"extra":["array(1)",{"a":"string(6)"}]');
  });

  it('maskUser hides most of the username', () => {
    expect(maskUser('zerodytester')).toBe('z***r');
    expect(maskUser(undefined)).toBeUndefined();
  });

  it('only accepts loopback WebSocket overrides', () => {
    expect(isLoopbackWsUrl('ws://127.0.0.1:21213/')).toBe(true);
    expect(isLoopbackWsUrl('ws://localhost:21213/')).toBe(true);
    expect(isLoopbackWsUrl('ws://evil.example.com:21213/')).toBe(false);
    expect(isLoopbackWsUrl('ws://user:pass@127.0.0.1:21213/')).toBe(false);
    expect(isLoopbackWsUrl('http://127.0.0.1:21213/')).toBe(false);
  });
});

describe('extractChat', () => {
  it('reads the documented v1 chat fields', () => {
    const x = extractChat({ comment: ' hi ', uniqueId: 'viewer1', nickname: 'V', msgId: '9', isSubscriber: true, profilePictureUrl: 'https://p16.tiktokcdn.com/x.jpg' });
    expect(x.status).toBe('final');
    expect(x.fields).toEqual({ comment: 'hi', username: 'viewer1', nickname: 'V', msgId: '9', isSubscriber: true, isModerator: undefined, avatarUrl: 'https://p16.tiktokcdn.com/x.jpg' });
  });

  it('accepts the nested user and rejects messages without text or user', () => {
    expect(extractChat({ comment: 'yo', user: { uniqueId: 'v2' } }).fields.username).toBe('v2');
    expect(extractChat({ uniqueId: 'v' }).status).toBe('unrecognized');
    expect(extractChat({ comment: 'x' }).missing).toEqual(['uniqueId']);
  });

  it('caps long messages and only keeps https avatars', () => {
    expect(extractChat({ comment: 'a'.repeat(500), uniqueId: 'v' }).fields.comment).toHaveLength(200);
    expect(extractChat({ comment: 'x', uniqueId: 'v', profilePictureUrl: 'javascript:alert(1)' }).fields.avatarUrl).toBeUndefined();
    expect(extractChat({ comment: 'x', uniqueId: 'v', profilePictureUrl: 'http://example.com/a.png' }).fields.avatarUrl).toBeUndefined();
  });
});
