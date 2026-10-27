// "Spotlight" corner bar: last gift, biggest gift of the stream, last
// follower and last share.

export const SPOTLIGHT_SCHEMA_VERSION = 1;

export type SpotlightItem = 'lastGift' | 'biggestGift' | 'lastFollow' | 'lastShare';
export const SPOTLIGHT_ITEMS: SpotlightItem[] = ['lastGift', 'biggestGift', 'lastFollow', 'lastShare'];

/** Visual template. */
export type SpotlightStyle = 'pill' | 'glass' | 'neon' | 'gold' | 'minimal';
export const SPOTLIGHT_STYLES: SpotlightStyle[] = ['pill', 'glass', 'neon', 'gold', 'minimal'];

/** Show every item at once, or one at a time in turn. */
export type SpotlightLayout = 'stack' | 'rotate';

export interface SpotlightConfig {
  schemaVersion: number;
  id: string;
  /** Owner of the record; checked before edits. Not exposed to overlays. */
  ownerId: string;
  name: string;
  style: SpotlightStyle;
  /** Items in display order (at least one). */
  items: SpotlightItem[];
  layout: SpotlightLayout;
  /** Seconds per item when rotating. */
  rotateSeconds: number;
  colors: [string, string];
  /** Hours without events after which the next event starts a new stream. */
  sessionGapHours: number;
  /** false = revoked: storage-loaded overlays stop updating. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The only fields an overlay page receives. */
export type PublicSpotlightConfig = Omit<SpotlightConfig, 'ownerId' | 'createdAt' | 'updatedAt'>;
