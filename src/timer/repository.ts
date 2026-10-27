// Local repository for gift timer configurations — same model and limits as the
// leaderboard repository (this browser only, owner = the same per-browser id),
// stored under its own key.

import { repository as giftRepository } from '../builder/repository/localRepository';
import { OwnershipError } from '../builder/repository/types';
import type { TimerConfig, PublicTimerConfig } from './types';
import { sanitizeTimer, toPublicTimer } from './validate';

const KEY = 'timer:configs:v1';

function readAll(): Record<string, unknown> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, unknown>): void {
  localStorage.setItem(KEY, JSON.stringify(all));
}

export const timerRepository = {
  currentOwnerId: () => giftRepository.currentOwnerId(),

  async listMine(): Promise<TimerConfig[]> {
    const owner = giftRepository.currentOwnerId();
    return Object.values(readAll())
      .map(sanitizeTimer)
      .filter((c): c is TimerConfig => c !== null && c.ownerId === owner)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id: string): Promise<TimerConfig | null> {
    return sanitizeTimer(readAll()[id]);
  },

  async getPublic(id: string): Promise<PublicTimerConfig | null> {
    const c = await this.get(id);
    return c ? toPublicTimer(c) : null;
  },

  async save(config: TimerConfig): Promise<TimerConfig> {
    const owner = giftRepository.currentOwnerId();
    const all = readAll();
    const existing = sanitizeTimer(all[config.id]);
    if (existing && existing.ownerId !== owner) throw new OwnershipError();
    const now = new Date().toISOString();
    const record = sanitizeTimer({ ...config, ownerId: owner, createdAt: existing?.createdAt ?? now, updatedAt: now });
    if (!record) throw new Error('Invalid configuration');
    all[record.id] = record;
    writeAll(all);
    return record;
  },

  async remove(id: string): Promise<void> {
    const all = readAll();
    const existing = sanitizeTimer(all[id]);
    if (existing && existing.ownerId !== giftRepository.currentOwnerId()) throw new OwnershipError();
    delete all[id];
    writeAll(all);
  },
};
