import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedChatEvent, NormalizedGiftEvent, NormalizedLikeEvent, NormalizedSocialEvent } from '../../../builder/giftEvents';
import { TikFinityEventApiAdapter, type SocketLike } from './TikFinityEventApiAdapter';

class FakeSocket implements SocketLike {
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onerror: SocketLike['onerror'] = null;
  onclose: SocketLike['onclose'] = null;
  closed = false;
  constructor(readonly url: string) {}
  close() {
    this.closed = true;
  }
  // test helpers
  open() {
    this.onopen?.({});
  }
  send(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
  fail(code = 1006) {
    this.onerror?.({});
    this.onclose?.({ code });
  }
}

const gift = (data: Record<string, unknown>) => ({ event: 'gift', data });
const rose = { giftId: 5655, giftName: 'Rose', giftType: 1, repeatCount: 1, repeatEnd: true, uniqueId: 'viewer1', msgId: '1001' };

function setup() {
  const sockets: FakeSocket[] = [];
  const adapter = new TikFinityEventApiAdapter({
    url: 'ws://127.0.0.1:21213/',
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    backoffMs: [100, 200, 400],
  });
  const events: NormalizedGiftEvent[] = [];
  return { adapter, sockets, events, onEvent: (e: NormalizedGiftEvent) => events.push(e) };
}

describe('TikFinityEventApiAdapter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('goes disconnected → connecting → connected', () => {
    const { adapter, sockets, onEvent } = setup();
    const seen: string[] = [];
    adapter.subscribe((s) => seen.push(s.status));
    adapter.connect(onEvent);
    sockets[0].open();
    expect(seen).toEqual(['disconnected', 'connecting', 'connected']);
    expect(sockets[0].url).toBe('ws://127.0.0.1:21213/');
    // Connected is not the same as verified live.
    expect(adapter.liveState.verifiedGiftAt).toBeNull();
    expect(adapter.state.detail).toMatch(/not verified live/i);
  });

  it('emits verified gifts as live (provider tikfinity, isTest false)', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].open();
    sockets[0].send(gift(rose));
    expect(events).toEqual([
      { type: 'gift', giftId: '5655', giftName: 'Rose', username: 'viewer1', nickname: undefined, repeatCount: 1, eventId: '1001', isTest: false, provider: 'tikfinity' },
    ]);
    expect(adapter.liveState.verifiedGiftAt).not.toBeNull();
    expect(adapter.liveState.layout).toBe('v1-flat');
  });

  it('ignores malformed JSON and unknown events without emitting', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].open();
    sockets[0].send('{oops');
    sockets[0].send({ event: 'mysteryEvent', data: { giftName: 'Rose' } });
    sockets[0].send({ event: 'like', data: { likeCount: 5 } });
    sockets[0].send(gift({ uniqueId: 'x' })); // gift without name or id
    expect(events).toHaveLength(0);
    const kinds = adapter.recentDiagnostics.map((d) => d.reason ?? `${d.event}:${d.known}:${d.gift?.status ?? ''}`);
    expect(kinds).toEqual(['gift:true:unrecognized', 'like:true:', 'mysteryEvent:false:', 'invalid JSON']);
    expect(adapter.liveState.messages).toBe(4);
    expect(adapter.liveState.verifiedGiftAt).toBeNull();
  });

  it('plays a streak once, with its final repeat count', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].open();
    for (let n = 1; n <= 4; n++) sockets[0].send(gift({ ...rose, msgId: `s${n}`, repeatCount: n, repeatEnd: false }));
    sockets[0].send(gift({ ...rose, msgId: 's5', repeatCount: 4, repeatEnd: true }));
    expect(events).toHaveLength(1);
    expect(events[0].repeatCount).toBe(4);
  });

  it('drops duplicate messages (same msgId, or repeated streak end without msgId)', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].open();
    sockets[0].send(gift(rose));
    sockets[0].send(gift(rose));
    const noId = { ...rose, msgId: undefined, repeatCount: 7 };
    sockets[0].send(gift(noId));
    sockets[0].send(gift(noId));
    expect(events.map((e) => e.repeatCount)).toEqual([1, 7]);
    expect(adapter.recentDiagnostics.filter((d) => d.gift?.status === 'duplicate')).toHaveLength(2);
  });

  it('connect() twice does not open a second socket', () => {
    const { adapter, sockets, onEvent } = setup();
    adapter.connect(onEvent);
    adapter.connect(onEvent);
    expect(sockets).toHaveLength(1);
  });

  it('reports an error with instructions when TikFinity is not running, then retries with backoff', () => {
    const { adapter, sockets, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].fail();
    expect(adapter.liveState.status).toBe('error');
    expect(adapter.state.detail).toMatch(/TikFinity Desktop running/);
    vi.advanceTimersByTime(99);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1].fail();
    vi.advanceTimersByTime(199);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('reconnects after a drop and ignores the old socket', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].open();
    const old = sockets[0];
    const oldOnMessage = old.onmessage;
    old.onclose?.({ code: 1006 });
    expect(adapter.liveState.status).toBe('disconnected');
    vi.advanceTimersByTime(100);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(adapter.liveState.status).toBe('connected');
    expect(adapter.liveState.attempts).toBe(0);
    // A late message on the dead socket must not be played.
    expect(old.onmessage).toBeNull();
    oldOnMessage?.({ data: JSON.stringify(gift({ ...rose, msgId: 'late' })) });
    sockets[1].send(gift({ ...rose, msgId: 'fresh' }));
    expect(events.map((e) => e.eventId)).toEqual(['fresh']);
  });

  it('disconnect() closes the socket, detaches handlers and stops reconnecting', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].fail(); // schedules a retry
    adapter.disconnect();
    vi.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(1);
    expect(adapter.liveState.status).toBe('disconnected');

    adapter.connect(onEvent);
    sockets[1].open();
    adapter.disconnect();
    expect(sockets[1].closed).toBe(true);
    expect(sockets[1].onmessage).toBeNull();
    expect(sockets[1].onclose).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(sockets).toHaveLength(2);
    expect(events).toHaveLength(0);
  });

  it('emits like batches as live events and drops duplicate like messages', () => {
    const { adapter, sockets, onEvent } = setup();
    const likes: NormalizedLikeEvent[] = [];
    adapter.connect(onEvent, { onLike: (l) => likes.push(l) });
    sockets[0].open();
    sockets[0].send({ event: 'like', data: { likeCount: 15, uniqueId: 'viewer1', msgId: 'L1' } });
    sockets[0].send({ event: 'like', data: { likeCount: 15, uniqueId: 'viewer1', msgId: 'L1' } });
    sockets[0].send({ event: 'like', data: { likeCount: 5, uniqueId: 'viewer2' } });
    sockets[0].send({ event: 'like', data: { uniqueId: 'viewer3' } }); // no count
    expect(likes).toEqual([
      { type: 'like', username: 'viewer1', nickname: undefined, likeCount: 15, eventId: 'L1', isTest: false, provider: 'tikfinity' },
      { type: 'like', username: 'viewer2', nickname: undefined, likeCount: 5, eventId: undefined, isTest: false, provider: 'tikfinity' },
    ]);
    expect(adapter.liveState.likesReceived).toBe(2);
    expect(adapter.recentDiagnostics.map((d) => d.like?.status)).toEqual(['unrecognized', 'final', 'duplicate', 'final']);
  });

  it('passes diamondCount through on final gifts', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].open();
    sockets[0].send(gift({ ...rose, diamondCount: 1, repeatCount: 5, msgId: 'd1' }));
    expect(events[0]).toMatchObject({ repeatCount: 5, diamondCount: 1 });
  });

  it('emits chat messages, keeps no text in diagnostics, and drops duplicates', () => {
    const { adapter, sockets, onEvent } = setup();
    const chats: NormalizedChatEvent[] = [];
    adapter.connect(onEvent, { onChat: (c) => chats.push(c) });
    sockets[0].open();
    const hello = { comment: 'hello there', uniqueId: 'viewer1', nickname: 'Viewer One', msgId: 'C1', isModerator: true, profilePictureUrl: 'https://p16.tiktokcdn.com/a.jpg' };
    sockets[0].send({ event: 'chat', data: hello });
    sockets[0].send({ event: 'chat', data: hello });
    sockets[0].send({ event: 'chat', data: { uniqueId: 'viewer2' } }); // no comment
    expect(chats).toEqual([
      {
        type: 'chat',
        username: 'viewer1',
        nickname: 'Viewer One',
        comment: 'hello there',
        avatarUrl: 'https://p16.tiktokcdn.com/a.jpg',
        isModerator: true,
        isSubscriber: undefined,
        eventId: 'C1',
        isTest: false,
        provider: 'tikfinity',
      },
    ]);
    expect(adapter.liveState.chatsReceived).toBe(1);
    expect(adapter.recentDiagnostics.map((d) => d.chat?.status)).toEqual(['unrecognized', 'duplicate', 'final']);
    expect(JSON.stringify(adapter.recentDiagnostics)).not.toContain('hello there');
  });

  it('counts follows and shares, dropping repeated msgIds', () => {
    const { adapter, sockets, onEvent } = setup();
    const social: NormalizedSocialEvent[] = [];
    adapter.connect(onEvent, { onSocial: (e) => social.push(e) });
    sockets[0].open();
    sockets[0].send({ event: 'follow', data: { uniqueId: 'a', msgId: 'F1' } });
    sockets[0].send({ event: 'follow', data: { uniqueId: 'a', msgId: 'F1' } });
    sockets[0].send({ event: 'share', data: { user: { uniqueId: 'b' } } });
    expect(social).toEqual([
      { type: 'follow', username: 'a', eventId: 'F1', isTest: false, provider: 'tikfinity' },
      { type: 'share', username: 'b', eventId: undefined, isTest: false, provider: 'tikfinity' },
    ]);
    expect(adapter.liveState.socialReceived).toBe(2);
  });

  it('gift-only pages ignore likes (no onLike given)', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    sockets[0].open();
    sockets[0].send({ event: 'like', data: { likeCount: 15, uniqueId: 'viewer1' } });
    expect(events).toHaveLength(0);
  });

  it('never invents events when the connection fails (no fake fallback)', () => {
    const { adapter, sockets, events, onEvent } = setup();
    adapter.connect(onEvent);
    for (let i = 0; i < 5; i++) {
      sockets[sockets.length - 1].fail();
      vi.advanceTimersByTime(1000);
    }
    expect(events).toHaveLength(0);
    adapter.disconnect();
  });
});
