// The one event shape every part of the overlay understands.
// Sources (mock adapter, URL trigger, a future TikFinity bridge) convert their
// own data into OverlayEvent; effects never see source-specific formats.

/**
 * Where an event came from. Only a real connector may use 'tikfinity'.
 * 'mock' and 'url' are local test events and are labelled as such in the UI.
 */
export type EventSource = 'mock' | 'url' | 'tikfinity';

export interface EventUser {
  username: string;
  nickname?: string;
  avatarUrl?: string;
}

interface BaseEvent {
  id: string;
  timestamp: number;
  source: EventSource;
  user: EventUser;
  /** Set when the event was forwarded from another browser tab. */
  relayed?: boolean;
}

export interface GiftEvent extends BaseEvent {
  type: 'gift';
  /** Provider gift id, when the source supplies one. */
  giftId?: string;
  giftName: string;
  repeatCount: number;
}

export interface FollowEvent extends BaseEvent {
  type: 'follow';
}

export interface LikeEvent extends BaseEvent {
  type: 'like';
  likeCount: number;
}

/** Any other LIVE event (share, subscribe, chat command, …) by name. */
export interface CustomEvent extends BaseEvent {
  type: 'custom';
  name: string;
  data?: Record<string, unknown>;
}

export type OverlayEvent = GiftEvent | FollowEvent | LikeEvent | CustomEvent;
export type OverlayEventType = OverlayEvent['type'];

export function isSimulated(event: OverlayEvent): boolean {
  return event.source !== 'tikfinity';
}

export function displayName(user: EventUser): string {
  return user.nickname || user.username || 'Viewer';
}
