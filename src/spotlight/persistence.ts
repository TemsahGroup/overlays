// Spotlight storage, in the streamer's OBS browser (localStorage), keyed per
// configuration. Test/demo state is never saved.

import type { StorageLike } from '../leaderboard/persistence';
import { createSpotlight, sanitizeSpotlightState, type SpotlightState } from './store';

const key = (configId: string) => `spotlight:state:${configId}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSpotlight(configId: string, now: number, storage: StorageLike | null = defaultStorage()): SpotlightState {
  try {
    return sanitizeSpotlightState(JSON.parse(storage?.getItem(key(configId)) || 'null'), now);
  } catch {
    return createSpotlight(now);
  }
}

export function saveSpotlight(configId: string, state: SpotlightState, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(key(configId), JSON.stringify(state));
  } catch {
    /* quota or blocked storage — keep running from memory */
  }
}

export function clearSpotlight(configId: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(key(configId));
  } catch {
    /* ignore */
  }
}
