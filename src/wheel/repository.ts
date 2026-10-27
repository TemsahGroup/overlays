// Local repository for wheel configurations — same model and limits as the
// leaderboard repository (this browser only, owner = the same per-browser id),
// stored under its own key.

import { repository as giftRepository } from '../builder/repository/localRepository';
import { OwnershipError } from '../builder/repository/types';
import type { WheelConfig, PublicWheelConfig } from './types';
import { sanitizeWheel, toPublicWheel } from './validate';

const KEY = 'wheel:configs:v1';

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

export const wheelRepository = {
  currentOwnerId: () => giftRepository.currentOwnerId(),

  async listMine(): Promise<WheelConfig[]> {
    const owner = giftRepository.currentOwnerId();
    return Object.values(readAll())
      .map(sanitizeWheel)
      .filter((c): c is WheelConfig => c !== null && c.ownerId === owner)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id: string): Promise<WheelConfig | null> {
    return sanitizeWheel(readAll()[id]);
  },

  async getPublic(id: string): Promise<PublicWheelConfig | null> {
    const c = await this.get(id);
    return c ? toPublicWheel(c) : null;
  },

  async save(config: WheelConfig): Promise<WheelConfig> {
    const owner = giftRepository.currentOwnerId();
    const all = readAll();
    const existing = sanitizeWheel(all[config.id]);
    if (existing && existing.ownerId !== owner) throw new OwnershipError();
    const now = new Date().toISOString();
    const record = sanitizeWheel({ ...config, ownerId: owner, createdAt: existing?.createdAt ?? now, updatedAt: now });
    if (!record) throw new Error('Invalid configuration');
    all[record.id] = record;
    writeAll(all);
    return record;
  },

  async remove(id: string): Promise<void> {
    const all = readAll();
    const existing = sanitizeWheel(all[id]);
    if (existing && existing.ownerId !== giftRepository.currentOwnerId()) throw new OwnershipError();
    delete all[id];
    writeAll(all);
  },
};
