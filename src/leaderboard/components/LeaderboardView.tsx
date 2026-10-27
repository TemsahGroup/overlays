import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { bossState, xpLevel, type RankedRow, type ScoreMode } from '../store';
import type { LeaderboardKind, LeaderboardStyle } from '../types';

interface Props {
  title: string;
  kind: LeaderboardKind;
  rows: RankedRow[];
  mode: ScoreMode;
  colors: [string, string];
  topN: number;
  /** Shows a TEST DATA chip — any board fed by mock/demo events. */
  test: boolean;
  /** Language of the on-stream text ("Waiting for…") and card direction. */
  lang?: 'ar' | 'en';
  /** Visual template (default: glass card). */
  look?: LeaderboardStyle;
  /** Boss Raid: everyone's combined score (not only the top N). */
  total?: number;
  /** Boss Raid: health of the first boss. */
  bossHp?: number;
}

const TEXT = {
  en: { insertCoin: 'INSERT COIN', boss: 'BOSS', hits: 'damage', mvp: 'MVP', defeated: 'DEFEATED!', overtook: '↑ #{n}' },
  ar: { insertCoin: 'INSERT COIN', boss: 'الوحش', hits: 'ضرب', mvp: 'MVP', defeated: 'اتهزم!', overtook: '↑ #{n}' },
};

const WAITING = {
  en: { gifters: 'Waiting for gifts…', likers: 'Waiting for likes…' },
  ar: { gifters: 'مستنيين الهدايا…', likers: 'مستنيين اللايكات…' },
};

// Layout units (1u = 1% of the board width, capped by height).
const HEADER_U = 16;
const ROW_U = 12;
const PAD_U = 5;
const PODIUM_U = 46;
const TICKER_TITLE_U = 36;
const TICKER_CHIP_U = 44;
const TICKER_H_U = 20;
/** Extra height some looks add around the rows. */
const EXTRA_U: Partial<Record<LeaderboardStyle, number>> = { arcade: 8, esports: 9, tower: 14, boss: 30 };

const BOSSES = ['👹', '🐉', '👾', '🦖', '💀', '🐙', '🤖', '👻'];
const ORDINALS = ['1ST', '2ND', '3RD'];
const tierOf = (level: number) => (level >= 35 ? 'diamond' : level >= 20 ? 'gold' : level >= 10 ? 'silver' : 'bronze');
const arcadeScore = (n: number) => (n > 999_999 ? compactFmt(n) : String(Math.floor(n)).padStart(6, '0'));

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const compactFmt = (n: number) => compact.format(n);
const MEDALS = ['👑', '🥈', '🥉'];

function unitLabel(kind: LeaderboardKind, mode: ScoreMode): string {
  if (kind === 'likers') return '❤️';
  return mode === 'coins' ? '🪙' : '🎁';
}

/** Units the board needs, per style, so it fits any OBS source size. */
function unitFor(look: LeaderboardStyle, w: number, h: number, topN: number): number {
  if (look === 'ticker') return Math.min(w / (TICKER_TITLE_U + topN * TICKER_CHIP_U + 2), h / TICKER_H_U);
  const rest = (look === 'podium' ? Math.max(0, topN - 3) * ROW_U + PODIUM_U : topN * ROW_U) + (EXTRA_U[look] ?? 0);
  return Math.min(w / 100, h / (HEADER_U + rest + PAD_U));
}

const NO_ROWS: RankedRow[] = [];
const initial = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase();

/** Rows in stable DOM order (by key) so React never moves a node; position comes from the rank. */
const stable = (rows: RankedRow[]) => [...rows].sort((a, b) => a.key.localeCompare(b.key));

function Score({ row, kind, mode }: { row: RankedRow; kind: LeaderboardKind; mode: ScoreMode }) {
  return (
    <span key={row.score} className="lb-score">
      {compact.format(row.score)} <span className="lb-unit">{unitLabel(kind, mode)}</span>
    </span>
  );
}

/** Remembers the last rank of each viewer and reports who just moved up (Esports feed). */
function useOvertake(rows: RankedRow[]): { name: string; rank: number; id: number } | null {
  const prev = useRef<Map<string, number> | null>(null);
  const [last, setLast] = useState<{ name: string; rank: number; id: number } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = new Map(rows.map((r) => [r.key, r.rank]));
    if (!before) return;
    const climber = rows.find((r) => before.has(r.key) && r.rank < before.get(r.key)!) ?? rows.find((r) => !before.has(r.key) && r.rank <= 3 && before.size > 0);
    if (climber) setLast({ name: climber.name, rank: climber.rank, id: Date.now() });
  }, [rows]);
  return last;
}

/** Inside of one ranked row, per look. */
function RowContent({ r, kind, mode, look, max, t }: { r: RankedRow; kind: LeaderboardKind; mode: ScoreMode; look: LeaderboardStyle; max: number; t: (typeof TEXT)['en'] }) {
  switch (look) {
    case 'arcade':
      return (
        <>
          <span className="lb-rank">{ORDINALS[r.rank - 1] ?? `${r.rank}TH`}</span>
          <span className="lb-name" dir="auto">{r.name}</span>
          <span key={r.score} className="lb-score">{arcadeScore(r.score)}</span>
        </>
      );
    case 'race': {
      const pct = max > 0 ? Math.min(1, r.score / max) : 0;
      return (
        <>
          <span className="lb-rank">{r.rank}</span>
          <span className="lb-name" dir="auto">{r.name}</span>
          <span className="lb-track">
            <span className="lb-car" style={{ insetInlineStart: `${pct * 86}%` }}>
              <span key={r.score} className="lb-car-body">🏎️</span>
            </span>
            <span className="lb-finish">🏁</span>
          </span>
          <Score row={r} kind={kind} mode={mode} />
        </>
      );
    }
    case 'rpg': {
      const { level, progress } = xpLevel(r.score);
      return (
        <>
          <span key={level} className={`lb-level lb-level--${tierOf(level)}`}>
            <small>Lv</small>
            {level}
          </span>
          <span className="lb-xp-who">
            <span className="lb-name" dir="auto">{r.name}</span>
            <span className="lb-xp">
              <span className="lb-xp-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          </span>
          <Score row={r} kind={kind} mode={mode} />
        </>
      );
    }
    case 'boss':
      return (
        <>
          <span className="lb-rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
          <span className="lb-name" dir="auto">{r.name}</span>
          <span key={r.score} className="lb-score">
            ⚔️ {compact.format(r.score)} <span className="lb-unit">{t.hits}</span>
          </span>
        </>
      );
    case 'esports':
      return (
        <>
          <span className="lb-rank">#{r.rank}</span>
          <span className="lb-name" dir="auto">{r.name}</span>
          {r.rank === 1 && <span className="lb-mvp">{t.mvp}</span>}
          <Score row={r} kind={kind} mode={mode} />
        </>
      );
    case 'tower':
      return (
        <>
          <span className="lb-floor">{r.rank}</span>
          <span className="lb-climber">{r.rank === 1 ? '🤴' : '🧗'}</span>
          <span className="lb-name" dir="auto">{r.name}</span>
          <Score row={r} kind={kind} mode={mode} />
        </>
      );
    default:
      return (
        <>
          <span className="lb-rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
          {look === 'pills' && <span className="lb-avatar">{initial(r.name)}</span>}
          <span className="lb-name" dir="auto">{r.name}</span>
          <Score row={r} kind={kind} mode={mode} />
        </>
      );
  }
}

/**
 * Transparent leaderboard in one of several looks. Rows are positioned by
 * rank and transition their position, so re-ordering slides smoothly.
 */
export function LeaderboardView({ title, kind, rows, mode, colors, topN, test, lang = 'en', look = 'glass', total, bossHp = 1000 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(5);

  useEffect(() => {
    const el = ref.current!;
    const update = () => setUnit(Math.max(1, unitFor(look, el.clientWidth, el.clientHeight, topN)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [topN, look]);

  const style = { '--u': `${unit}px`, '--lb-a': colors[0], '--lb-b': colors[1], '--rows': topN } as CSSProperties;
  const waitingItem = <li className="lb-empty">{WAITING[lang][kind]}</li>;
  const t = TEXT[lang];
  const overtake = useOvertake(look === 'esports' ? rows : NO_ROWS);
  const head: ReactNode = (
    <header className="lb-head">
      <span className="lb-icon">{kind === 'likers' ? '❤️' : '🏆'}</span>
      <span className="lb-title">{title}</span>
      {test && <span className="lb-test">TEST DATA</span>}
    </header>
  );

  let body: ReactNode;
  if (look === 'ticker') {
    body = (
      <section className="lb-ticker" aria-label={title} style={{ '--chips': topN } as CSSProperties}>
        <div className="lb-ticker-title">
          <span className="lb-icon">{kind === 'likers' ? '❤️' : '🏆'}</span>
          <span className="lb-title">{title}</span>
          {test && <span className="lb-test">TEST</span>}
        </div>
        <ol className="lb-ticker-list">
          {rows.length === 0 && waitingItem}
          {stable(rows).map((r) => (
            <li key={r.key} className={`lb-chip lb-row--${r.rank}`} style={{ insetInlineStart: `calc(var(--u) * ${(r.rank - 1) * TICKER_CHIP_U})` }}>
              <span className="lb-rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
              <span className="lb-name" dir="auto">{r.name}</span>
              <Score row={r} kind={kind} mode={mode} />
            </li>
          ))}
        </ol>
      </section>
    );
  } else if (look === 'podium') {
    const top = [2, 1, 3].map((rank) => rows.find((r) => r.rank === rank) ?? null);
    const rest = rows.filter((r) => r.rank > 3);
    body = (
      <section className="lb-card lb-card--podium" aria-label={title}>
        {head}
        {rows.length === 0 ? (
          <div className="lb-empty">{WAITING[lang][kind]}</div>
        ) : (
          <div className="lb-podium">
            {top.map((r, i) => {
              const rank = [2, 1, 3][i];
              return (
                <div key={rank} className={`lb-slot lb-slot--${rank} ${r ? '' : 'is-empty'}`}>
                  {r && (
                    <div key={r.key} className="lb-slot-who">
                      {rank === 1 && <span className="lb-crown">👑</span>}
                      <span className="lb-avatar">{initial(r.name)}</span>
                      <span className="lb-name" dir="auto">{r.name}</span>
                      <Score row={r} kind={kind} mode={mode} />
                    </div>
                  )}
                  <div className="lb-step">
                    <span>{rank}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {topN > 3 && (
          <ol className="lb-list" style={{ '--rows': topN - 3 } as CSSProperties}>
            {stable(rest).map((r) => (
              <li key={r.key} className="lb-row" style={{ transform: `translateY(calc(var(--u) * ${(r.rank - 4) * ROW_U}))` }}>
                <span className="lb-rank">{r.rank}</span>
                <span className="lb-name" dir="auto">{r.name}</span>
                <Score row={r} kind={kind} mode={mode} />
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  } else {
    const max = rows[0]?.score ?? 0;
    const boss = look === 'boss' ? bossState(total ?? rows.reduce((a, r) => a + r.score, 0), bossHp) : null;
    body = (
      <section className={`lb-card lb-card--${look}`} aria-label={title}>
        {look === 'tower' && <div className="lb-roof" aria-hidden="true"><span>🏆</span></div>}
        {head}
        {boss && (
          <div className="lb-boss">
            <span key={boss.level} className="lb-boss-face">
              <span key={total} className="lb-boss-hit">{BOSSES[(boss.level - 1) % BOSSES.length]}</span>
            </span>
            <div className="lb-boss-info">
              <div className="lb-boss-name">
                <span>{t.boss} Lv {boss.level}</span>
                <span className="lb-boss-hp-text" dir="ltr">
                  {compact.format(boss.hp)} / {compact.format(boss.maxHp)} <span className="lb-unit">{unitLabel(kind, mode)}</span>
                </span>
              </div>
              <div className="lb-boss-bar">
                <span className="lb-boss-fill" style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
              </div>
            </div>
            {boss.level > 1 && (
              <span key={`ko${boss.level}`} className="lb-boss-ko">
                {t.defeated}
              </span>
            )}
          </div>
        )}
        <ol className="lb-list">
          {rows.length === 0 && waitingItem}
          {stable(rows).map((r) => (
            <li key={r.key} className={`lb-row lb-row--${r.rank}`} style={{ transform: `translateY(calc(var(--u) * ${(r.rank - 1) * ROW_U}))` }}>
              <RowContent r={r} kind={kind} mode={mode} look={look} max={max} t={t} />
            </li>
          ))}
        </ol>
        {look === 'arcade' && <div className="lb-insert">{t.insertCoin}</div>}
        {look === 'esports' && (
          <div className="lb-feed">
            {overtake && (
              <span key={overtake.id} className="lb-feed-item">
                ⚔️ <span dir="auto">{overtake.name}</span> {t.overtook.replace('{n}', String(overtake.rank))}
              </span>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <div ref={ref} className={`lb lb--${look}`} style={style} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      {body}
    </div>
  );
}
