// Development repository backed by localStorage.
//
// Limits (also shown in the builder UI):
//  • data lives in THIS browser profile only — OBS has its own storage, so an
//    /overlay/:id link that relies on this repository will not find the config
//    there (use the portable link instead, see portable.ts);
//  • the "owner" is a random id per browser profile, not an authenticated user.

import { newId, sanitizeConfig, toPublic } from '../validate';
import type { OverlayConfig, PublicOverlayConfig } from '../types';
import { OwnershipError, type ConfigRepository } from './types';

const KEY_CONFIGS = 'gift-builder:configs:v1';
const KEY_OWNER = 'gift-builder:owner:v1';

function readAll(): Record<string, unknown> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_CONFIGS) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, unknown>): void {
  localStorage.setItem(KEY_CONFIGS, JSON.stringify(all));
}

export class LocalConfigRepository implements ConfigRepository {
  readonly capabilities = {
    sharedAcrossDevices: false,
    revocable: true,
    label: 'Local (this browser only)',
  };

  private ownerId: string;

  constructor() {
    let id: string | null = null;
    try {
      id = localStorage.getItem(KEY_OWNER);
      if (!id) {
        id = newId();
        localStorage.setItem(KEY_OWNER, id);
      }
    } catch {
      id = newId(); // storage blocked: owner lives for this page only
    }
    this.ownerId = id;
  }

  currentOwnerId(): string {
    return this.ownerId;
  }

  async listMine(): Promise<OverlayConfig[]> {
    return Object.values(readAll())
      .map(sanitizeConfig)
      .filter((c): c is OverlayConfig => c !== null && c.ownerId === this.ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<OverlayConfig | null> {
    return sanitizeConfig(readAll()[id]);
  }

  async getPublic(id: string): Promise<PublicOverlayConfig | null> {
    const c = await this.get(id);
    return c ? toPublic(c) : null;
  }

  async save(config: OverlayConfig): Promise<OverlayConfig> {
    const all = readAll();
    const existing = sanitizeConfig(all[config.id]);
    if (existing && existing.ownerId !== this.ownerId) throw new OwnershipError();
    const now = new Date().toISOString();
    const record = sanitizeConfig({
      ...config,
      ownerId: this.ownerId, // never trust the incoming owner
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (!record) throw new Error('Invalid configuration');
    all[record.id] = record;
    writeAll(all);
    return record;
  }

  async setEnabled(id: string, enabled: boolean): Promise<OverlayConfig> {
    const c = await this.get(id);
    if (!c) throw new Error('Configuration not found');
    return this.save({ ...c, enabled });
  }

  async remove(id: string): Promise<void> {
    const all = readAll();
    const existing = sanitizeConfig(all[id]);
    if (existing && existing.ownerId !== this.ownerId) throw new OwnershipError();
    delete all[id];
    writeAll(all);
  }
}

export const repository: ConfigRepository = new LocalConfigRepository();
