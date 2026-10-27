// Stream progress storage for goal bars, in the streamer's OBS browser
// (localStorage), keyed per configuration. Test/demo progress is never saved.

import type { StorageLike } from '../leaderboard/persistence';
import { createProgress, sanitizeProgress, type GoalProgress } from './store';

const key = (configId: string) => `goal:progress:${configId}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadProgress(configId: string, now: number, storage: StorageLike | null = defaultStorage()): GoalProgress {
  if (!storage) return createProgress(now);
  try {
    return sanitizeProgress(JSON.parse(storage.getItem(key(configId)) || 'null'), now);
  } catch {
    return createProgress(now);
  }
}

export function clearProgress(configId: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(key(configId));
  } catch {
    /* ignore */
  }
}

/** Debounced writer (like batches can arrive several times a second). Call flush() on page hide. */
export function createProgressSaver(configId: string, delayMs = 1500, storage: StorageLike | null = defaultStorage()) {
  let pending: GoalProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) {
      try {
        storage?.setItem(key(configId), JSON.stringify(pending));
      } catch {
        /* quota or blocked storage — keep running from memory */
      }
    }
    pending = null;
  };
  return {
    save(p: GoalProgress) {
      pending = p;
      if (!timer) timer = setTimeout(flush, delayMs);
    },
    flush,
  };
}
