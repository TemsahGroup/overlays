// Goal bar configuration (separate from the other overlay types).

export const GOAL_SCHEMA_VERSION = 1;

/** What the goal counts. */
export type GoalMetric = 'coins' | 'likes' | 'follows' | 'shares';
export const GOAL_METRICS: GoalMetric[] = ['coins', 'likes', 'follows', 'shares'];

/** Visual template of the bar. */
export type GoalStyle = 'classic' | 'neon' | 'liquid' | 'segments' | 'battery' | 'ring';
export const GOAL_STYLES: GoalStyle[] = ['classic', 'neon', 'liquid', 'segments', 'battery', 'ring'];

export interface GoalConfig {
  schemaVersion: number;
  id: string;
  /** Owner of the record; checked before edits. Not exposed to overlays. */
  ownerId: string;
  name: string;
  metric: GoalMetric;
  style: GoalStyle;
  title: string;
  /** Goal amount (coins, likes, follows or shares). */
  target: number;
  /** When reached, the next goal is set automatically (+target each time). */
  autoNext: boolean;
  /** [accent, secondary accent] */
  colors: [string, string];
  /** Hours without events after which the next event starts a new stream. */
  sessionGapHours: number;
  /** false = revoked: storage-loaded overlays stop updating. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The only fields an overlay page receives. */
export type PublicGoalConfig = Omit<GoalConfig, 'ownerId' | 'createdAt' | 'updatedAt'>;
