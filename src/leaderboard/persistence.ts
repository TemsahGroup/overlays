// Session storage for live leaderboards. Lives in the streamer's OBS browser
// (localStorage), keyed per configuration. Test/demo sessions are never saved.

import { createSession, sanitizeSession, type LeaderboardSession } from './store';

const key = (configId: string) => `leaderboard:session:${configId}`;

/** Minimal storage surface so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // blocked storage: the board still works for this page load
  }
}

export function loadSession(configId: string, now: number, storage: StorageLike | null = defaultStorage()): LeaderboardSession {
  if (!storage) return createSession(now);
  try {
    return sanitizeSession(JSON.parse(storage.getItem(key(configId)) || 'null'), now);
  } catch {
    return createSession(now);
  }
}

export function saveSession(configId: string, session: LeaderboardSession, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(key(configId), JSON.stringify(session));
  } catch {
    /* quota or blocked storage — keep running from memory */
  }
}

export function clearSession(configId: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(key(configId));
  } catch {
    /* ignore */
  }
}

/**
 * Debounced writer: busy streams can send several like batches per second,
 * so writes are coalesced. Call flush() on page hide / unmount.
 */
export function createSessionSaver(configId: string, delayMs = 1500, storage: StorageLike | null = defaultStorage()) {
  let pending: LeaderboardSession | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) saveSession(configId, pending, storage);
    pending = null;
  };
  return {
    save(session: LeaderboardSession) {
      pending = session;
      if (!timer) timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
