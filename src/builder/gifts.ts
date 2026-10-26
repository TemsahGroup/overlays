// Local gift catalog for the picker. Names only, with emoji as icons — no
// TikTok artwork is bundled and no gift ids are guessed. Gift names and
// availability vary by region and change over time, so the picker also
// accepts any custom name; check the exact name in TikFinity's gift list.

export interface GiftInfo {
  name: string;
  icon: string;
  /** Rough coin tier for sorting in the picker (not an official price). */
  tier: 1 | 2 | 3 | 4;
}

export const GIFT_CATALOG: GiftInfo[] = [
  { name: 'Rose', icon: '🌹', tier: 1 },
  { name: 'TikTok', icon: '🎵', tier: 1 },
  { name: 'GG', icon: '🎮', tier: 1 },
  { name: 'Ice Cream Cone', icon: '🍦', tier: 1 },
  { name: 'Heart Me', icon: '💗', tier: 1 },
  { name: 'Finger Heart', icon: '🫰', tier: 1 },
  { name: 'Doughnut', icon: '🍩', tier: 2 },
  { name: 'Hand Hearts', icon: '🫶', tier: 2 },
  { name: 'Perfume', icon: '🧴', tier: 2 },
  { name: 'Hat and Mustache', icon: '🎩', tier: 2 },
  { name: 'Corgi', icon: '🐶', tier: 3 },
  { name: 'Money Gun', icon: '💸', tier: 3 },
  { name: 'Galaxy', icon: '🌌', tier: 3 },
  { name: 'Fireworks', icon: '🎆', tier: 3 },
  { name: 'Lion', icon: '🦁', tier: 4 },
  { name: 'Universe', icon: '🪐', tier: 4 },
];

export function giftIcon(name: string): string {
  return GIFT_CATALOG.find((g) => g.name.toLowerCase() === name.trim().toLowerCase())?.icon ?? '🎁';
}

export function searchGifts(query: string): GiftInfo[] {
  const q = query.trim().toLowerCase();
  return q ? GIFT_CATALOG.filter((g) => g.name.toLowerCase().includes(q)) : GIFT_CATALOG;
}
