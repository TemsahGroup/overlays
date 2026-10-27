// Local repository for chat configurations — same model and limits as the
// leaderboard repository (this browser only, owner = the same per-browser id),
// stored under its own key.

import { repository as giftRepository } from '../builder/repository/localRepository';
import { OwnershipError } from '../builder/repository/types';
import type { ChatConfig, PublicChatConfig } from './types';
import { sanitizeChat, toPublicChat } from './validate';

const KEY = 'chat:configs:v1';

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

export const chatRepository = {
  currentOwnerId: () => giftRepository.currentOwnerId(),

  async listMine(): Promise<ChatConfig[]> {
    const owner = giftRepository.currentOwnerId();
    return Object.values(readAll())
      .map(sanitizeChat)
      .filter((c): c is ChatConfig => c !== null && c.ownerId === owner)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id: string): Promise<ChatConfig | null> {
    return sanitizeChat(readAll()[id]);
  },

  async getPublic(id: string): Promise<PublicChatConfig | null> {
    const c = await this.get(id);
    return c ? toPublicChat(c) : null;
  },

  async save(config: ChatConfig): Promise<ChatConfig> {
    const owner = giftRepository.currentOwnerId();
    const all = readAll();
    const existing = sanitizeChat(all[config.id]);
    if (existing && existing.ownerId !== owner) throw new OwnershipError();
    const now = new Date().toISOString();
    const record = sanitizeChat({ ...config, ownerId: owner, createdAt: existing?.createdAt ?? now, updatedAt: now });
    if (!record) throw new Error('Invalid configuration');
    all[record.id] = record;
    writeAll(all);
    return record;
  },

  async remove(id: string): Promise<void> {
    const all = readAll();
    const existing = sanitizeChat(all[id]);
    if (existing && existing.ownerId !== giftRepository.currentOwnerId()) throw new OwnershipError();
    delete all[id];
    writeAll(all);
  },
};
