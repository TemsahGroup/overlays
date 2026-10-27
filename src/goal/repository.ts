// Local repository for goal bar configurations — same model and limits as the
// leaderboard repository (this browser only, owner = the same per-browser id),
// stored under its own key.

import { repository as giftRepository } from '../builder/repository/localRepository';
import { OwnershipError } from '../builder/repository/types';
import type { GoalConfig, PublicGoalConfig } from './types';
import { sanitizeGoal, toPublicGoal } from './validate';

const KEY = 'goal:configs:v1';

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

export const goalRepository = {
  currentOwnerId: () => giftRepository.currentOwnerId(),

  async listMine(): Promise<GoalConfig[]> {
    const owner = giftRepository.currentOwnerId();
    return Object.values(readAll())
      .map(sanitizeGoal)
      .filter((c): c is GoalConfig => c !== null && c.ownerId === owner)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id: string): Promise<GoalConfig | null> {
    return sanitizeGoal(readAll()[id]);
  },

  async getPublic(id: string): Promise<PublicGoalConfig | null> {
    const c = await this.get(id);
    return c ? toPublicGoal(c) : null;
  },

  async save(config: GoalConfig): Promise<GoalConfig> {
    const owner = giftRepository.currentOwnerId();
    const all = readAll();
    const existing = sanitizeGoal(all[config.id]);
    if (existing && existing.ownerId !== owner) throw new OwnershipError();
    const now = new Date().toISOString();
    const record = sanitizeGoal({ ...config, ownerId: owner, createdAt: existing?.createdAt ?? now, updatedAt: now });
    if (!record) throw new Error('Invalid configuration');
    all[record.id] = record;
    writeAll(all);
    return record;
  },

  async remove(id: string): Promise<void> {
    const all = readAll();
    const existing = sanitizeGoal(all[id]);
    if (existing && existing.ownerId !== giftRepository.currentOwnerId()) throw new OwnershipError();
    delete all[id];
    writeAll(all);
  },
};
