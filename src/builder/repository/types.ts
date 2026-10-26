import type { OverlayConfig, PublicOverlayConfig } from '../types';

/** What the current storage can actually do — shown honestly in the UI. */
export interface RepositoryCapabilities {
  /** Overlay URLs work on other computers (needs a hosted backend). */
  sharedAcrossDevices: boolean;
  /** Revoking takes effect for every copy of the overlay URL. */
  revocable: boolean;
  label: string;
}

export class OwnershipError extends Error {
  constructor() {
    super('This configuration belongs to another owner and cannot be changed here.');
  }
}

/**
 * Storage boundary for builder configurations. The builder only talks to this
 * interface, so a hosted implementation (HTTP API + database + auth) can
 * replace the local one without UI changes. See src/builder/BACKEND.md.
 */
export interface ConfigRepository {
  readonly capabilities: RepositoryCapabilities;
  /** Identity of the current editor (a session user in a hosted version). */
  currentOwnerId(): string;
  listMine(): Promise<OverlayConfig[]>;
  /** Full record; only for the owner's editor. */
  get(id: string): Promise<OverlayConfig | null>;
  /** Public fields only; used by overlay pages. */
  getPublic(id: string): Promise<PublicOverlayConfig | null>;
  /** Creates or updates. Throws OwnershipError for someone else's record. */
  save(config: OverlayConfig): Promise<OverlayConfig>;
  setEnabled(id: string, enabled: boolean): Promise<OverlayConfig>;
  remove(id: string): Promise<void>;
}
