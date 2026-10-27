// Live adapter for the TikFinity Event API (local WebSocket, desktop app).
//
// • One socket at a time; connect() is idempotent, handlers are assigned as
//   properties and detached from replaced sockets, so listeners never stack.
// • Reconnects with backoff while active; disconnect() stops everything.
// • Only messages parsed as documented gift events become NormalizedGiftEvents
//   with provider 'tikfinity' / isTest false. No fallback to fake events.

import {
  Deduper,
  type ConnectionState,
  type GiftEventAdapter,
  type NormalizedChatEvent,
  type NormalizedGiftEvent,
  type NormalizedLikeEvent,
} from '../../../builder/giftEvents';
import { describeShape, extractChat, extractGift, extractLike, maskUser, parseMessage, type GiftExtraction, type GiftLayout } from './parse';

/** Default from the project brief; TikFinity's page shows ws://localhost:21213/ (same loopback service). */
export const DEFAULT_EVENT_API_URL = 'ws://127.0.0.1:21213/';
const BACKOFF_MS = [1000, 2000, 5000, 10000, 15000];
const MAX_DIAGNOSTICS = 50;

export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LiveState {
  status: LiveStatus;
  detail: string;
  url: string;
  /** Consecutive failed attempts since the last successful open. */
  attempts: number;
  messages: number;
  giftsReceived: number;
  likesReceived: number;
  chatsReceived: number;
  lastMessageAt: number | null;
  /** Set only after a real gift message was parsed — the "verified live" signal. */
  verifiedGiftAt: number | null;
  layout: GiftLayout | null;
}

export interface DiagnosticEntry {
  at: number;
  kind: 'malformed' | 'event';
  event?: string;
  known?: boolean;
  reason?: string;
  /** Payload structure without values. */
  shape?: unknown;
  gift?: {
    status: GiftExtraction['status'] | 'duplicate';
    layout: GiftLayout;
    missing: string[];
    giftId?: string;
    giftName?: string;
    giftType?: number;
    repeatCount?: number;
    repeatEnd?: boolean;
    diamondCount?: number;
    user?: string;
  };
  like?: {
    status: 'final' | 'unrecognized' | 'duplicate';
    missing: string[];
    likeCount?: number;
    user?: string;
  };
  /** Chat text is never kept in diagnostics — only its length. */
  chat?: {
    status: 'final' | 'unrecognized' | 'duplicate';
    missing: string[];
    length?: number;
    user?: string;
  };
}

export interface ConnectOptions {
  /** Receives like batches (leaderboards). Gift-only pages leave it out. */
  onLike?: (event: NormalizedLikeEvent) => void;
  /** Receives chat messages (chat overlay). */
  onChat?: (event: NormalizedChatEvent) => void;
}

/** Minimal WebSocket surface used here (lets tests inject a fake). */
export interface SocketLike {
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
  close(code?: number, reason?: string): void;
}
export type SocketFactory = (url: string) => SocketLike;

export interface AdapterOptions {
  url?: string;
  createSocket?: SocketFactory;
  backoffMs?: number[];
  now?: () => number;
}

const NOT_RUNNING_HINT = 'Is TikFinity Desktop running on this computer and connected to your LIVE?';

export class TikFinityEventApiAdapter implements GiftEventAdapter {
  readonly name = 'tikfinity-event-api';
  private socket: SocketLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private onEvent: ((e: NormalizedGiftEvent) => void) | null = null;
  private onLike: ((e: NormalizedLikeEvent) => void) | null = null;
  private onChat: ((e: NormalizedChatEvent) => void) | null = null;
  private stateListeners = new Set<(s: LiveState) => void>();
  private diagListeners = new Set<(d: DiagnosticEntry) => void>();
  private diagnostics: DiagnosticEntry[] = [];
  private dedupe = new Deduper(5 * 60_000);
  private createSocket: SocketFactory;
  private backoff: number[];
  private now: () => number;
  private live: LiveState;

  constructor(options: AdapterOptions = {}) {
    const url = options.url ?? DEFAULT_EVENT_API_URL;
    this.createSocket = options.createSocket ?? ((u) => new WebSocket(u) as unknown as SocketLike);
    this.backoff = options.backoffMs ?? BACKOFF_MS;
    this.now = options.now ?? Date.now;
    this.live = {
      status: 'disconnected',
      detail: 'Not started.',
      url,
      attempts: 0,
      messages: 0,
      giftsReceived: 0,
      likesReceived: 0,
      chatsReceived: 0,
      lastMessageAt: null,
      verifiedGiftAt: null,
      layout: null,
    };
  }

  /** GiftEventAdapter view of the status. */
  get state(): ConnectionState {
    return { status: this.live.status, detail: this.live.detail };
  }

  get liveState(): LiveState {
    return this.live;
  }

  get recentDiagnostics(): DiagnosticEntry[] {
    return this.diagnostics;
  }

  subscribe(fn: (s: LiveState) => void): () => void {
    this.stateListeners.add(fn);
    fn(this.live);
    return () => {
      this.stateListeners.delete(fn);
    };
  }

  onDiagnostic(fn: (d: DiagnosticEntry) => void): () => void {
    this.diagListeners.add(fn);
    return () => {
      this.diagListeners.delete(fn);
    };
  }

  connect(onEvent: (event: NormalizedGiftEvent) => void, options: ConnectOptions = {}): void {
    this.onEvent = onEvent;
    this.onLike = options.onLike ?? null;
    this.onChat = options.onChat ?? null;
    if (this.active) return; // already running: never open a second socket
    this.active = true;
    this.open();
  }

  disconnect(): void {
    this.active = false;
    this.onEvent = null;
    this.onLike = null;
    this.onChat = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ws = this.socket;
    this.socket = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close(1000, 'overlay closed');
      } catch {
        /* already closed */
      }
    }
    this.setState({ status: 'disconnected', detail: 'Stopped.' });
  }

  private setState(patch: Partial<LiveState>): void {
    this.live = { ...this.live, ...patch };
    this.stateListeners.forEach((fn) => fn(this.live));
  }

  private open(): void {
    if (!this.active) return;
    this.setState({ status: 'connecting', detail: `Connecting to ${this.live.url}…` });
    let ws: SocketLike;
    try {
      ws = this.createSocket(this.live.url);
    } catch (e) {
      this.setState({ status: 'error', detail: `Could not open WebSocket: ${e instanceof Error ? e.message : 'unknown error'}` });
      this.scheduleReconnect();
      return;
    }
    this.socket = ws;

    ws.onopen = () => {
      if (this.socket !== ws) return;
      this.setState({
        status: 'connected',
        attempts: 0,
        detail: this.live.verifiedGiftAt
          ? 'Connected to TikFinity Desktop.'
          : 'Connected to TikFinity Desktop. No gift received yet — not verified live.',
      });
    };
    ws.onmessage = (ev) => {
      if (this.socket === ws) this.handleMessage(ev.data);
    };
    ws.onerror = () => {
      if (this.socket !== ws) return;
      // Browsers deliberately hide the reason; the close event follows.
      this.setState({ status: 'error', detail: `Connection error. ${NOT_RUNNING_HINT}` });
    };
    ws.onclose = (ev) => {
      if (this.socket !== ws) return;
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      this.socket = null;
      if (!this.active) return;
      const wasConnected = this.live.status === 'connected';
      this.setState({
        status: wasConnected ? 'disconnected' : 'error',
        detail: wasConnected
          ? `Connection closed${ev?.code ? ` (code ${ev.code})` : ''}. Reconnecting…`
          : `Cannot reach ${this.live.url}. ${NOT_RUNNING_HINT}`,
      });
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.active || this.timer) return;
    const delay = this.backoff[Math.min(this.live.attempts, this.backoff.length - 1)];
    this.live = { ...this.live, attempts: this.live.attempts + 1 };
    this.setState({ detail: `${this.live.detail} Retrying in ${Math.round(delay / 1000)} s.` });
    this.timer = setTimeout(() => {
      this.timer = null;
      this.open();
    }, delay);
  }

  private record(entry: DiagnosticEntry): void {
    this.diagnostics = [entry, ...this.diagnostics].slice(0, MAX_DIAGNOSTICS);
    this.diagListeners.forEach((fn) => fn(entry));
  }

  /** Exposed for tests; normally called by the socket. */
  handleMessage(raw: unknown): void {
    const at = this.now();
    this.setState({ messages: this.live.messages + 1, lastMessageAt: at });
    const parsed = parseMessage(raw);
    if (parsed.kind === 'malformed') {
      this.record({ at, kind: 'malformed', reason: parsed.reason });
      return;
    }
    const entry: DiagnosticEntry = { at, kind: 'event', event: parsed.event, known: parsed.known, shape: describeShape(parsed.data) };
    if (parsed.event === 'like') {
      this.handleLike(parsed.data, entry, at);
      return;
    }
    if (parsed.event === 'chat') {
      this.handleChat(parsed.data, entry, at);
      return;
    }
    if (parsed.event !== 'gift') {
      this.record(entry);
      return;
    }

    const x = extractGift(parsed.data);
    const f = x.fields;
    entry.gift = {
      status: x.status,
      layout: x.layout,
      missing: x.missing,
      giftId: f.giftId,
      giftName: f.giftName,
      giftType: f.giftType,
      repeatCount: f.repeatCount,
      repeatEnd: f.repeatEnd,
      diamondCount: f.diamondCount,
      user: maskUser(f.username),
    };

    if (x.status !== 'final') {
      this.record(entry);
      return;
    }

    // Duplicate guard: the documented msgId when present; otherwise the
    // final streak message's identity, which TikTok may resend.
    const key = f.msgId
      ? `msg:${f.msgId}`
      : f.repeatEnd === true
        ? `end:${f.username ?? '?'}:${f.giftId ?? f.giftName}:${f.repeatCount ?? 1}`
        : undefined;
    if (this.dedupe.isDuplicate(key, at)) {
      entry.gift.status = 'duplicate';
      this.record(entry);
      return;
    }
    this.record(entry);

    this.setState({
      giftsReceived: this.live.giftsReceived + 1,
      verifiedGiftAt: at,
      layout: x.layout,
      detail: 'Connected to TikFinity Desktop. Live gift events received.',
    });
    this.onEvent?.({
      type: 'gift',
      giftId: f.giftId,
      giftName: f.giftName ?? `gift ${f.giftId}`,
      username: f.username ?? 'viewer',
      nickname: f.nickname,
      repeatCount: f.repeatCount && f.repeatCount > 0 ? f.repeatCount : 1,
      eventId: f.msgId,
      isTest: false,
      provider: 'tikfinity',
      diamondCount: f.diamondCount,
    });
  }

  private handleLike(data: Record<string, unknown>, entry: DiagnosticEntry, at: number): void {
    const x = extractLike(data);
    const f = x.fields;
    entry.like = { status: x.status, missing: x.missing, likeCount: f.likeCount, user: maskUser(f.username) };
    if (x.status !== 'final' || !f.likeCount || !f.username) {
      this.record(entry);
      return;
    }
    if (this.dedupe.isDuplicate(f.msgId ? `like:${f.msgId}` : undefined, at)) {
      entry.like.status = 'duplicate';
      this.record(entry);
      return;
    }
    this.record(entry);
    this.setState({ likesReceived: this.live.likesReceived + 1 });
    this.onLike?.({
      type: 'like',
      username: f.username,
      nickname: f.nickname,
      likeCount: f.likeCount,
      eventId: f.msgId,
      isTest: false,
      provider: 'tikfinity',
    });
  }

  private handleChat(data: Record<string, unknown>, entry: DiagnosticEntry, at: number): void {
    const x = extractChat(data);
    const f = x.fields;
    entry.chat = { status: x.status, missing: x.missing, length: f.comment?.length, user: maskUser(f.username) };
    if (x.status !== 'final' || !f.comment || !f.username) {
      this.record(entry);
      return;
    }
    if (this.dedupe.isDuplicate(f.msgId ? `chat:${f.msgId}` : undefined, at)) {
      entry.chat.status = 'duplicate';
      this.record(entry);
      return;
    }
    this.record(entry);
    this.setState({ chatsReceived: this.live.chatsReceived + 1 });
    this.onChat?.({
      type: 'chat',
      username: f.username,
      nickname: f.nickname,
      comment: f.comment,
      avatarUrl: f.avatarUrl,
      isModerator: f.isModerator,
      isSubscriber: f.isSubscriber,
      eventId: f.msgId,
      isTest: false,
      provider: 'tikfinity',
    });
  }
}
