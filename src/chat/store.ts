// Chat message list — pure functions, no React, no storage. Messages live in
// memory only; nothing viewers write is ever saved.

import type { PublicChatConfig } from './types';

export interface ChatMessage {
  id: string;
  kind: 'chat' | 'gift';
  /** Lower-case username, used for the name colour. */
  userKey: string;
  name: string;
  text: string;
  avatarUrl?: string;
  moderator?: boolean;
  subscriber?: boolean;
  /** Gift lines: gift name and count. */
  gift?: { name: string; count: number };
  at: number;
  test: boolean;
}

type Filter = Pick<PublicChatConfig, 'hideCommands' | 'blockedWords'>;

/** false for bot commands (when hidden) and messages with a blocked word. */
export function isAllowed(text: string, filter: Filter): boolean {
  const t = text.trim();
  if (!t) return false;
  if (filter.hideCommands && t.startsWith('!')) return false;
  const lower = t.toLowerCase();
  return !filter.blockedWords.some((w) => w && lower.includes(w));
}

/** Appends and keeps only the newest `max` messages. */
export function pushMessage(list: ChatMessage[], msg: ChatMessage, max: number): ChatMessage[] {
  const next = [...list, msg];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Messages still on screen; `leaving` marks the last 600 ms before a fade-out. */
export function visibleMessages(list: ChatMessage[], now: number, fadeSeconds: number): { msg: ChatMessage; leaving: boolean }[] {
  if (fadeSeconds <= 0) return list.map((msg) => ({ msg, leaving: false }));
  const ttl = fadeSeconds * 1000;
  return list.filter((m) => now - m.at < ttl).map((msg) => ({ msg, leaving: now - msg.at > ttl - 600 }));
}

const NAME_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff8fab', '#ffa94d', '#8ce99a', '#74c0fc', '#f783ac'];

/** Stable colour per viewer, so the same name always has the same colour. */
export function nameColor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}
