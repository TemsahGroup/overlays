// Wheel of fortune configuration (separate from the other overlay types).

export const WHEEL_SCHEMA_VERSION = 1;

/** Visual template of the wheel. */
export type WheelStyle = 'classic' | 'neon' | 'casino' | 'candy' | 'arcade';
export const WHEEL_STYLES: WheelStyle[] = ['classic', 'neon', 'casino', 'candy', 'arcade'];

/** What spins the wheel: one chosen gift, or any gift worth at least N coins. */
export type WheelTrigger = 'gift' | 'coins';

export interface WheelSegment {
  label: string;
  color: string;
}

export interface WheelConfig {
  schemaVersion: number;
  id: string;
  /** Owner of the record; checked before edits. Not exposed to overlays. */
  ownerId: string;
  name: string;
  style: WheelStyle;
  title: string;
  segments: WheelSegment[];
  trigger: WheelTrigger;
  /** Gift that spins the wheel (trigger 'gift'), matched by name like gift effects. */
  giftName: string;
  /** Minimum coin value of one gift streak (trigger 'coins'). */
  minCoins: number;
  /** true: a streak of 5 gifts = 5 spins; false: one spin per streak. */
  spinEach: boolean;
  /** Seconds a spin takes (3–10). */
  spinSeconds: number;
  /** Only show the wheel while it spins and shows a result. */
  hideWhenIdle: boolean;
  /** false = revoked: storage-loaded overlays stop spinning. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The only fields an overlay page receives. */
export type PublicWheelConfig = Omit<WheelConfig, 'ownerId' | 'createdAt' | 'updatedAt'>;
