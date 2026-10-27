// Chat overlay configuration (separate from gift effects and leaderboards).

export const CHAT_SCHEMA_VERSION = 1;

/** Visual template of the chat box. */
export type ChatStyle = 'bubbles' | 'glass' | 'classic' | 'neon' | 'comic' | 'retro' | 'dialog' | 'esports' | 'sticky' | 'ticker';
export const CHAT_STYLES: ChatStyle[] = ['bubbles', 'glass', 'classic', 'neon', 'comic', 'retro', 'dialog', 'esports', 'sticky', 'ticker'];

export interface ChatConfig {
  schemaVersion: number;
  id: string;
  /** Owner of the record; checked before edits. Not exposed to overlays. */
  ownerId: string;
  name: string;
  style: ChatStyle;
  /** Messages kept on screen (3–20). */
  maxMessages: number;
  /** Seconds before a message fades out; 0 = stays until pushed out. */
  fadeSeconds: number;
  /** Text size in percent (70–160). */
  textScale: number;
  /** [accent, secondary accent] */
  colors: [string, string];
  showAvatars: boolean;
  /** Also show "🎁 name · Rose ×5" lines for gifts. */
  showGifts: boolean;
  /** Hide bot commands that start with "!". */
  hideCommands: boolean;
  /** Messages containing any of these words are not shown. */
  blockedWords: string[];
  /** false = revoked: storage-loaded overlays stop showing messages. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The only fields an overlay page receives. */
export type PublicChatConfig = Omit<ChatConfig, 'ownerId' | 'createdAt' | 'updatedAt'>;
