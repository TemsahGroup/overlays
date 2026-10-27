// Countdown state — pure functions, no React, no storage.
//
// While running, the timer stores the moment it ends (endsAt); while paused
// it stores the time left. Time left is therefore exact after an OBS refresh,
// and adding time just moves endsAt. Once it reaches zero the timer is over:
// later gifts no longer add time until it is reset.

import type { TimerRules } from './types';

export const TIMER_STATE_VERSION = 1;

export interface TimerState {
  version: number;
  running: boolean;
  /** When the countdown reaches zero (running only). */
  endsAt: number;
  /** Time left while paused or before the start. */
  leftMs: number;
  /** Last start, pause, add or reset — used to detect a new stream. */
  lastActivityAt: number;
  /** Total time added by viewers in this stream. */
  addedMs: number;
}

export function createTimer(startMs: number, now: number, autoStart: boolean): TimerState {
  return { version: TIMER_STATE_VERSION, running: autoStart, endsAt: now + startMs, leftMs: startMs, lastActivityAt: now, addedMs: 0 };
}

export function timeLeft(s: TimerState, now: number): number {
  return Math.max(0, s.running ? s.endsAt - now : s.leftMs);
}

export const isOver = (s: TimerState, now: number) => timeLeft(s, now) <= 0;

export function pause(s: TimerState, now: number): TimerState {
  return s.running ? { ...s, running: false, leftMs: timeLeft(s, now), lastActivityAt: now } : s;
}

export function resume(s: TimerState, now: number): TimerState {
  return s.running || s.leftMs <= 0 ? s : { ...s, running: true, endsAt: now + s.leftMs, lastActivityAt: now };
}

/** Adds (or with a negative amount removes) time; respects the cap; nothing after the end. */
export function addTime(s: TimerState, ms: number, now: number, capMs = 0, byViewer = true): TimerState {
  const left = timeLeft(s, now);
  if (left <= 0 || !Number.isFinite(ms) || ms === 0) return s;
  let next = Math.max(0, left + ms);
  if (capMs > 0) next = Math.min(next, Math.max(capMs, left));
  const added = next - left;
  if (added === 0) return s;
  return {
    ...s,
    endsAt: s.running ? now + next : s.endsAt,
    leftMs: s.running ? s.leftMs : next,
    lastActivityAt: now,
    addedMs: byViewer ? s.addedMs + Math.max(0, added) : s.addedMs,
  };
}

/** Seconds a final gift earns: value × repeatCount coins, or 1 coin per gift when no value is sent. */
export function giftSeconds(rules: TimerRules, gift: { repeatCount: number; diamondCount?: number }): number {
  const count = Math.max(1, Math.floor(gift.repeatCount) || 1);
  const value = gift.diamondCount !== undefined && Number.isFinite(gift.diamondCount) && gift.diamondCount > 0 ? Math.floor(gift.diamondCount) : 1;
  return rules.perCoin * value * count;
}

/** Likes add time in steps of 100; the remainder carries over to the next batch. */
export function likeSeconds(rules: TimerRules, carry: number, likeCount: number): { seconds: number; carry: number } {
  const total = carry + Math.max(0, Math.floor(likeCount));
  return { seconds: Math.floor(total / 100) * rules.per100Likes, carry: total % 100 };
}

/** A gap of `gapHours` without any activity is treated as a new stream. */
export function shouldStartNew(s: TimerState, now: number, gapHours: number): boolean {
  return now - s.lastActivityAt > gapHours * 3_600_000 && (isOver(s, now) || !s.running);
}

export function sanitizeTimerState(raw: unknown): TimerState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  if (o.version !== TIMER_STATE_VERSION) return null;
  return {
    version: TIMER_STATE_VERSION,
    running: o.running === true,
    endsAt: num(o.endsAt),
    leftMs: num(o.leftMs),
    lastActivityAt: num(o.lastActivityAt),
    addedMs: num(o.addedMs),
  };
}

/** "1:05:09" or "05:09". */
export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "+1m 30s", "+45s", "+2h 5m". */
export function formatAdd(seconds: number): string {
  const sign = seconds < 0 ? '−' : '+';
  let s = Math.abs(Math.round(seconds));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const parts = [h ? `${h}h` : '', m ? `${m}m` : '', s || (!h && !m) ? `${s}s` : ''].filter(Boolean);
  return sign + parts.join(' ');
}
