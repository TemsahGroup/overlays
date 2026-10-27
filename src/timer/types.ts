// Gift timer ("subathon") configuration: a countdown that gifts, follows,
// shares and likes extend.

export const TIMER_SCHEMA_VERSION = 1;

/** Visual template of the timer. */
export type TimerStyle = 'digital' | 'neon' | 'flip' | 'arcade' | 'minimal';
export const TIMER_STYLES: TimerStyle[] = ['digital', 'neon', 'flip', 'arcade', 'minimal'];

export interface TimerRules {
  /** Seconds added per coin of gift value (a gift without a value counts as 1 coin). */
  perCoin: number;
  perFollow: number;
  perShare: number;
  /** Seconds added per 100 likes. */
  per100Likes: number;
}

export interface TimerConfig {
  schemaVersion: number;
  id: string;
  /** Owner of the record; checked before edits. Not exposed to overlays. */
  ownerId: string;
  name: string;
  style: TimerStyle;
  title: string;
  /** Starting time in minutes. */
  startMinutes: number;
  rules: TimerRules;
  /** Upper limit for the time left, in hours; 0 = no limit. */
  maxHours: number;
  /** Start counting as soon as the overlay opens (otherwise press Start in ?setup=1). */
  autoStart: boolean;
  /** Show "+30s name" when time is added. */
  showAdds: boolean;
  /** Show the rules ("1 coin = +10s") under the time. */
  showRules: boolean;
  colors: [string, string];
  /** Hours without activity after which the next stream starts a fresh timer. */
  sessionGapHours: number;
  /** false = revoked: storage-loaded overlays stop updating. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The only fields an overlay page receives. */
export type PublicTimerConfig = Omit<TimerConfig, 'ownerId' | 'createdAt' | 'updatedAt'>;
