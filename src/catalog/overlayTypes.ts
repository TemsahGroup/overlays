// The overlay library. Every overlay type gets an entry here; the home page
// renders this list, so adding a new type starts with one object below.

import type { StringKey } from '../ui/strings';

export interface OverlayType {
  id: string;
  icon: string;
  title: StringKey;
  description: StringKey;
  /** Editor route, or null while the type is not built yet. */
  href: string | null;
  /** Accent used on the home card. */
  accent: string;
}

export const OVERLAY_TYPES: OverlayType[] = [
  { id: 'gifts', icon: '🎁', title: 'type.gifts.title', description: 'type.gifts.desc', href: '#/builder', accent: '#fe2c55' },
  { id: 'leaderboards', icon: '🏆', title: 'type.leaderboards.title', description: 'type.leaderboards.desc', href: '#/leaderboards', accent: '#ffd166' },
  { id: 'goal', icon: '🎯', title: 'type.goal.title', description: 'type.goal.desc', href: '#/goals', accent: '#25f4ee' },
  { id: 'chat', icon: '💬', title: 'type.chat.title', description: 'type.chat.desc', href: '#/chats', accent: '#7c5cff' },
  { id: 'wheel', icon: '🎡', title: 'type.wheel.title', description: 'type.wheel.desc', href: null, accent: '#ff8fb1' },
  { id: 'timer', icon: '⏱️', title: 'type.timer.title', description: 'type.timer.desc', href: null, accent: '#3ddc84' },
];
