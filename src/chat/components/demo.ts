// TEST chat for previews and ?demo=1. Never from TikTok, always flagged test.

import type { ChatMessage } from '../store';

const VIEWERS = ['sara.live', 'omar_99', 'lina.art', 'yousef', 'mona.k', 'karim.dev', 'nour', 'ziad.fm', 'hana', 'adam'];
const LINES = [
  'السلام عليكم 👋',
  'Hello from Cairo!',
  'أحلى بث النهارده 🔥🔥',
  'gg 😂',
  'ممكن تلعب الماب التاني؟',
  'Let’s gooo 🚀',
  'منور يا كبير ❤️',
  'first time here, love the overlay',
  'هههههه',
  'تحياتي من الإسكندرية 🌊',
  'what game is this?',
  'يلا نكسب الجولة دي 💪',
];
const GIFTS = ['Rose', 'TikTok', 'Finger Heart', 'Lion', 'Galaxy'];

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
let seq = 0;

export function demoMessage(now: number, giftChance = 0.15): ChatMessage {
  const userKey = pick(VIEWERS);
  const base = { id: `test-${now}-${seq++}`, userKey, name: userKey, at: now, test: true };
  if (Math.random() < giftChance) {
    return { ...base, kind: 'gift', text: '', gift: { name: pick(GIFTS), count: pick([1, 1, 5, 10]) } };
  }
  return { ...base, kind: 'chat', text: pick(LINES), moderator: Math.random() < 0.1, subscriber: Math.random() < 0.15 };
}
