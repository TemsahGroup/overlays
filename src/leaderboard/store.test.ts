import { describe, expect, it } from 'vitest';
import { clearSession, createSessionSaver, loadSession, saveSession, type StorageLike } from './persistence';
import { addGift, addLike, bossState, createSession, rank, sanitizeSession, scoreMode, shouldStartNewSession, totalScore, xpLevel } from './store';
import { sanitizeLeaderboard, sanitizePublicLeaderboard, toPublicLeaderboard, newLeaderboard } from './validate';

const T0 = 1_700_000_000_000;

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('gifters scoring', () => {
  it('ranks by coin value (diamondCount × repeatCount)', () => {
    let s = createSession(T0);
    s = addGift(s, { username: 'a', repeatCount: 10, diamondCount: 1 }, T0 + 1); // 10 coins
    s = addGift(s, { username: 'b', repeatCount: 1, diamondCount: 99 }, T0 + 2); // 99 coins
    s = addGift(s, { username: 'a', repeatCount: 5, diamondCount: 1 }, T0 + 3); // a: 15
    expect(scoreMode(s)).toBe('coins');
    expect(rank(s, 'gifters', 5).map((r) => [r.key, r.score])).toEqual([
      ['b', 99],
      ['a', 15],
    ]);
  });

  it('falls back to gift count once any gift has no value — never mixes units', () => {
    let s = createSession(T0);
    s = addGift(s, { username: 'a', repeatCount: 1, diamondCount: 500 }, T0 + 1);
    s = addGift(s, { username: 'b', repeatCount: 3 }, T0 + 2);
    expect(scoreMode(s)).toBe('count');
    expect(rank(s, 'gifters', 5).map((r) => [r.key, r.score])).toEqual([
      ['b', 3],
      ['a', 1],
    ]);
  });

  it('counts a finished streak once (the adapter only emits the final message)', () => {
    let s = createSession(T0);
    s = addGift(s, { username: 'a', repeatCount: 7, diamondCount: 1 }, T0 + 1);
    expect(rank(s, 'gifters', 5)[0].score).toBe(7);
  });

  it('merges users case-insensitively and shows the latest nickname', () => {
    let s = createSession(T0);
    s = addGift(s, { username: 'Sara', repeatCount: 1, diamondCount: 1 }, T0 + 1);
    s = addGift(s, { username: 'sara', nickname: 'Sara ✨', repeatCount: 1, diamondCount: 1 }, T0 + 2);
    expect(rank(s, 'gifters', 5)).toEqual([{ rank: 1, key: 'sara', name: 'Sara ✨', score: 2 }]);
  });
});

describe('likers scoring', () => {
  it('sums likeCount per viewer and ignores non-positive counts', () => {
    let s = createSession(T0);
    s = addLike(s, { username: 'a', likeCount: 15 }, T0 + 1);
    s = addLike(s, { username: 'b', likeCount: 40 }, T0 + 2);
    s = addLike(s, { username: 'a', likeCount: 30 }, T0 + 3);
    s = addLike(s, { username: 'c', likeCount: 0 }, T0 + 4);
    s = addLike(s, { username: 'c', likeCount: -5 }, T0 + 5);
    expect(rank(s, 'likers', 5).map((r) => [r.key, r.score])).toEqual([
      ['a', 45],
      ['b', 40],
    ]);
  });

  it('a gifters board ignores likes and vice versa', () => {
    let s = createSession(T0);
    s = addLike(s, { username: 'a', likeCount: 100 }, T0 + 1);
    expect(rank(s, 'gifters', 5)).toEqual([]);
  });
});

describe('ranking', () => {
  it('breaks ties by who reached the score first, and limits to topN', () => {
    let s = createSession(T0);
    s = addLike(s, { username: 'late', likeCount: 10 }, T0 + 20);
    s = addLike(s, { username: 'early', likeCount: 10 }, T0 + 10);
    for (let i = 0; i < 8; i++) s = addLike(s, { username: `u${i}`, likeCount: 1 }, T0 + 30 + i);
    const top = rank(s, 'likers', 3);
    expect(top.map((r) => r.key)).toEqual(['early', 'late', 'u0']);
    expect(top.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe('game looks', () => {
  it('total damage counts every viewer, not only the top N', () => {
    let s = createSession(T0);
    for (let i = 0; i < 8; i++) s = addGift(s, { username: `u${i}`, repeatCount: 1, diamondCount: 10 }, T0 + i);
    expect(rank(s, 'gifters', 3)).toHaveLength(3);
    expect(totalScore(s, 'gifters')).toBe(80);
    expect(totalScore(s, 'likers')).toBe(0);
  });

  it('boss health carries leftover damage to a stronger next boss', () => {
    expect(bossState(0, 1000)).toEqual({ level: 1, maxHp: 1000, hp: 1000 });
    expect(bossState(999, 1000)).toEqual({ level: 1, maxHp: 1000, hp: 1 });
    expect(bossState(1000, 1000)).toEqual({ level: 2, maxHp: 1500, hp: 1500 });
    expect(bossState(1700, 1000)).toEqual({ level: 2, maxHp: 1500, hp: 800 });
    expect(bossState(1e12, 10).level).toBeLessThanOrEqual(999);
  });

  it('RPG levels grow with score', () => {
    expect(xpLevel(0)).toEqual({ level: 1, progress: 0 });
    expect(xpLevel(500).level).toBe(11);
    expect(xpLevel(10_000).level).toBe(45);
    const { progress } = xpLevel(30);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });
});

describe('sessions', () => {
  it('starts a new session after the configured gap without events', () => {
    let s = createSession(T0);
    expect(shouldStartNewSession(s, T0 + 10 * 3_600_000, 3)).toBe(false); // no events yet
    s = addLike(s, { username: 'a', likeCount: 1 }, T0);
    expect(shouldStartNewSession(s, T0 + 2 * 3_600_000, 3)).toBe(false);
    expect(shouldStartNewSession(s, T0 + 3 * 3_600_000 + 1, 3)).toBe(true);
  });

  it('sanitizes corrupted or foreign stored data', () => {
    expect(sanitizeSession('nope', T0).entries).toEqual({});
    expect(sanitizeSession({ version: 99, entries: {} }, T0).entries).toEqual({});
    const s = sanitizeSession({ version: 1, startedAt: T0, lastEventAt: T0, entries: { a: { name: 5, coins: -3, likes: 'x', gifts: 2 } } }, T0);
    expect(s.entries.a).toEqual({ name: 'a', coins: 0, gifts: 2, likes: 0, updatedAt: 0 });
  });
});

describe('persistence', () => {
  it('saves, loads and clears per configuration', () => {
    const storage = memoryStorage();
    const s = addLike(createSession(T0), { username: 'a', likeCount: 5 }, T0);
    saveSession('cfg1', s, storage);
    expect(loadSession('cfg1', T0, storage).entries.a.likes).toBe(5);
    expect(loadSession('cfg2', T0, storage).entries).toEqual({});
    clearSession('cfg1', storage);
    expect(loadSession('cfg1', T0, storage).entries).toEqual({});
  });

  it('survives corrupted JSON in storage', () => {
    const storage = memoryStorage();
    storage.setItem('leaderboard:session:cfg1', '{broken');
    expect(loadSession('cfg1', T0, storage).entries).toEqual({});
  });

  it('debounced saver writes the latest session once', () => {
    const storage = memoryStorage();
    const saver = createSessionSaver('cfg1', 10_000, storage);
    let s = createSession(T0);
    for (let i = 1; i <= 5; i++) {
      s = addLike(s, { username: 'a', likeCount: 1 }, T0 + i);
      saver.save(s);
    }
    expect(storage.data.size).toBe(0);
    saver.flush();
    expect(loadSession('cfg1', T0, storage).entries.a.likes).toBe(5);
  });
});

describe('leaderboard config validation', () => {
  it('applies safe defaults and limits', () => {
    const c = sanitizeLeaderboard({ id: 'abcdef123', ownerId: 'owner12345', kind: 'weird', topN: 99, colors: ['red', '#00ff00'], sessionGapHours: 0 });
    expect(c).toMatchObject({ kind: 'gifters', topN: 10, colors: ['#ffd166', '#00ff00'], sessionGapHours: 1, title: 'Top Gifters' });
  });

  it('keeps a known board style and falls back to glass for old or invalid data', () => {
    const base = { id: 'abcdef123', ownerId: 'owner12345' };
    expect(sanitizeLeaderboard({ ...base, style: 'podium' })?.style).toBe('podium');
    expect(sanitizeLeaderboard({ ...base, style: 'ticker' })?.style).toBe('ticker');
    expect(sanitizeLeaderboard({ ...base, style: 'sparkly' })?.style).toBe('glass');
    expect(sanitizeLeaderboard(base)?.style).toBe('glass'); // saved before styles existed
    expect(sanitizePublicLeaderboard({ id: 'abcdef123', style: 'neon' })?.style).toBe('neon');
    expect(sanitizeLeaderboard({ ...base, style: 'boss' })?.style).toBe('boss');
  });

  it('boss health has a per-kind default and stays within limits', () => {
    const base = { id: 'abcdef123', ownerId: 'owner12345' };
    expect(sanitizeLeaderboard(base)?.bossHp).toBe(1000);
    expect(sanitizeLeaderboard({ ...base, kind: 'likers' })?.bossHp).toBe(5000);
    expect(sanitizeLeaderboard({ ...base, bossHp: 2 })?.bossHp).toBe(10);
    expect(sanitizeLeaderboard({ ...base, bossHp: 'lots' })?.bossHp).toBe(1000);
  });

  it('public projection drops the owner', () => {
    const pub = toPublicLeaderboard(newLeaderboard('owner12345', 'likers'));
    expect(pub).not.toHaveProperty('ownerId');
    expect(sanitizePublicLeaderboard(pub)?.kind).toBe('likers');
    expect(sanitizePublicLeaderboard({ id: 'bad id' })).toBeNull();
  });
});
