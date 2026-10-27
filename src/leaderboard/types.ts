// Leaderboard widget configuration (separate from gift-effect configurations).

export const LEADERBOARD_SCHEMA_VERSION = 1;

export type LeaderboardKind = 'gifters' | 'likers';

/** Visual template of the board. */
export type LeaderboardStyle = 'glass' | 'podium' | 'neon' | 'royal' | 'pills' | 'ticker';
export const LEADERBOARD_STYLES: LeaderboardStyle[] = ['glass', 'podium', 'neon', 'royal', 'pills', 'ticker'];

export interface LeaderboardConfig {
  schemaVersion: number;
  id: string;
  /** Owner of the record; checked before edits. Not exposed to overlays. */
  ownerId: string;
  name: string;
  kind: LeaderboardKind;
  /** Visual template; older saved boards default to 'glass'. */
  style: LeaderboardStyle;
  title: string;
  /** Rows shown on stream (3–10). */
  topN: number;
  /** [accent, secondary accent] */
  colors: [string, string];
  /** Hours without events after which the next event starts a new stream session. */
  sessionGapHours: number;
  /** false = revoked: storage-loaded overlays stop updating. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The only fields an overlay page receives. */
export type PublicLeaderboardConfig = Omit<LeaderboardConfig, 'ownerId' | 'createdAt' | 'updatedAt'>;
