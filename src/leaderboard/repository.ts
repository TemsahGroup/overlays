// Local repository for leaderboard configurations — same model and limits as
// the gift builder's LocalConfigRepository (this browser only, owner = the
// same per-browser id), stored under its own key so gift configs are untouched.

import { repository as giftRepository } from '../builder/repository/localRepository';
import { OwnershipError } from '../builder/repository/types';
import type { LeaderboardConfig, PublicLeaderboardConfig } from './types';
import { sanitizeLeaderboard, toPublicLeaderboard } from './validate';

const KEY = 'leaderboard:configs:v1';

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

export const leaderboardRepository = {
  label: giftRepository.capabilities.label,

  currentOwnerId: () => giftRepository.currentOwnerId(),

  async listMine(): Promise<LeaderboardConfig[]> {
    const owner = giftRepository.currentOwnerId();
    return Object.values(readAll())
      .map(sanitizeLeaderboard)
      .filter((c): c is LeaderboardConfig => c !== null && c.ownerId === owner)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id: string): Promise<LeaderboardConfig | null> {
    return sanitizeLeaderboard(readAll()[id]);
  },

  async getPublic(id: string): Promise<PublicLeaderboardConfig | null> {
    const c = await this.get(id);
    return c ? toPublicLeaderboard(c) : null;
  },

  async save(config: LeaderboardConfig): Promise<LeaderboardConfig> {
    const owner = giftRepository.currentOwnerId();
    const all = readAll();
    const existing = sanitizeLeaderboard(all[config.id]);
    if (existing && existing.ownerId !== owner) throw new OwnershipError();
    const now = new Date().toISOString();
    const record = sanitizeLeaderboard({ ...config, ownerId: owner, createdAt: existing?.createdAt ?? now, updatedAt: now });
    if (!record) throw new Error('Invalid configuration');
    all[record.id] = record;
    writeAll(all);
    return record;
  },

  async remove(id: string): Promise<void> {
    const all = readAll();
    const existing = sanitizeLeaderboard(all[id]);
    if (existing && existing.ownerId !== giftRepository.currentOwnerId()) throw new OwnershipError();
    delete all[id];
    writeAll(all);
  },
};
