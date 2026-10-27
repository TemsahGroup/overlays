import { describe, expect, it } from 'vitest';
import { isAllowed, nameColor, pushMessage, visibleMessages, type ChatMessage } from './store';
import { cleanWords, newChat, sanitizeChat, sanitizePublicChat, toPublicChat } from './validate';

const msg = (id: string, at = 0): ChatMessage => ({ id, kind: 'chat', userKey: 'u', name: 'u', text: 'hi', at, test: true });

describe('chat filter', () => {
  const filter = { hideCommands: true, blockedWords: ['spam', 'بايخ'] };
  it('hides bot commands, blocked words and empty messages', () => {
    expect(isAllowed('hello', filter)).toBe(true);
    expect(isAllowed('!points', filter)).toBe(false);
    expect(isAllowed('!points', { ...filter, hideCommands: false })).toBe(true);
    expect(isAllowed('buy SPAM now', filter)).toBe(false);
    expect(isAllowed('ده بايخ جدا', filter)).toBe(false);
    expect(isAllowed('   ', filter)).toBe(false);
  });
});

describe('chat list', () => {
  it('keeps only the newest messages', () => {
    let list: ChatMessage[] = [];
    for (let i = 0; i < 12; i++) list = pushMessage(list, msg(`m${i}`), 5);
    expect(list.map((m) => m.id)).toEqual(['m7', 'm8', 'm9', 'm10', 'm11']);
  });

  it('fades messages out after the configured time', () => {
    const list = [msg('old', 0), msg('leaving', 10_300), msg('new', 15_000)];
    expect(visibleMessages(list, 20_000, 0)).toHaveLength(3);
    const shown = visibleMessages(list, 20_000, 10);
    expect(shown.map((s) => [s.msg.id, s.leaving])).toEqual([
      ['leaving', true],
      ['new', false],
    ]);
  });

  it('gives each viewer a stable name colour', () => {
    expect(nameColor('sara')).toBe(nameColor('sara'));
    expect(nameColor('sara')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('chat config validation', () => {
  it('applies safe defaults and limits', () => {
    const c = sanitizeChat({ id: 'abcdef123', ownerId: 'owner12345', style: 'weird', maxMessages: 99, fadeSeconds: -5, textScale: 500, colors: ['red'] });
    expect(c).toMatchObject({ style: 'bubbles', maxMessages: 20, fadeSeconds: 0, textScale: 160, colors: ['#7c5cff', '#25f4ee'], showAvatars: true, hideCommands: true });
    expect(sanitizeChat({ id: 'abcdef123', ownerId: 'owner12345', style: 'dialog' })?.style).toBe('dialog');
    expect(sanitizeChat({ id: 'abcdef123', ownerId: 'owner12345', style: 'ticker' })?.style).toBe('ticker');
  });

  it('cleans the blocked word list', () => {
    expect(cleanWords([' Spam ', 'spam', '', 5, 'x'.repeat(50)])).toEqual(['spam', 'x'.repeat(30)]);
    expect(cleanWords(Array.from({ length: 80 }, (_, i) => `w${i}`))).toHaveLength(50);
    expect(cleanWords('nope')).toEqual([]);
  });

  it('public projection drops the owner', () => {
    const pub = toPublicChat(newChat('owner12345'));
    expect(pub).not.toHaveProperty('ownerId');
    expect(sanitizePublicChat(pub)?.style).toBe('bubbles');
    expect(sanitizePublicChat({ id: 'bad id' })).toBeNull();
  });
});
