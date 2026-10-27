// Countdown storage for gift timers, in the streamer's OBS browser
// (localStorage), keyed per configuration. Test/demo timers are never saved.

import type { StorageLike } from '../leaderboard/persistence';
import { sanitizeTimerState, type TimerState } from './store';

const key = (configId: string) => `timer:state:${configId}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadTimer(configId: string, storage: StorageLike | null = defaultStorage()): TimerState | null {
  try {
    return sanitizeTimerState(JSON.parse(storage?.getItem(key(configId)) || 'null'));
  } catch {
    return null;
  }
}

export function saveTimer(configId: string, state: TimerState, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(key(configId), JSON.stringify(state));
  } catch {
    /* quota or blocked storage — keep running from memory */
  }
}

export function clearTimer(configId: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(key(configId));
  } catch {
    /* ignore */
  }
}
