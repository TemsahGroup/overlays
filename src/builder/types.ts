// Gift Overlay Builder — configuration model.
//
// Version 1 stores one gift → effect mapping per configuration, but the model
// is already an array so several mappings can be supported later without a
// schema change.

export const SCHEMA_VERSION = 1;
export const MAX_MAPPINGS = 1; // raise when the UI supports more

export type BuilderEffectId =
  | 'rose-rain'
  | 'fireworks'
  | 'hearts'
  | 'gift-explosion'
  | 'live-gift'
  | 'live-follow'
  | 'live-like'
  | 'live-custom';

export type Intensity = 'low' | 'medium' | 'high';
export type Layout = '16:9' | '9:16';

export interface BuilderEffectSettings {
  colors: string[];
  count: number;
  /** Total effect length in ms. */
  duration: number;
  /** Base particle size in px. */
  size: number;
  intensity: Intensity;
}

export interface AlertSettings {
  enabled: boolean;
  /** Placeholders: {user} {gift} {count} */
  text: string;
  icon: string;
}

export interface GiftMapping {
  id: string;
  /** Provider gift id if known (optional: names are matched otherwise). */
  selectedGiftId: string | null;
  selectedGiftName: string;
  effectId: BuilderEffectId;
  effectSettings: BuilderEffectSettings;
  alertSettings: AlertSettings;
}

/** Full record, as stored by the repository. Never contains secrets. */
export interface OverlayConfig {
  schemaVersion: number;
  id: string;
  /** Owner of the record; checked before edits. Not exposed to overlays. */
  ownerId: string;
  name: string;
  layout: Layout;
  mappings: GiftMapping[];
  /** false = revoked: the overlay URL stops playing. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The only fields an overlay page receives. */
export interface PublicOverlayConfig {
  schemaVersion: number;
  id: string;
  name: string;
  layout: Layout;
  mappings: GiftMapping[];
  enabled: boolean;
}
