import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { RankedRow, ScoreMode } from '../store';
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
}

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

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const MEDALS = ['👑', '🥈', '🥉'];

function unitLabel(kind: LeaderboardKind, mode: ScoreMode): string {
  if (kind === 'likers') return '❤️';
  return mode === 'coins' ? '🪙' : '🎁';
}

/** Units the board needs, per style, so it fits any OBS source size. */
function unitFor(look: LeaderboardStyle, w: number, h: number, topN: number): number {
  if (look === 'ticker') return Math.min(w / (TICKER_TITLE_U + topN * TICKER_CHIP_U + 2), h / TICKER_H_U);
  const rest = look === 'podium' ? Math.max(0, topN - 3) * ROW_U + PODIUM_U : topN * ROW_U;
  return Math.min(w / 100, h / (HEADER_U + rest + PAD_U));
}

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

/**
 * Transparent leaderboard in one of several looks. Rows are positioned by
 * rank and transition their position, so re-ordering slides smoothly.
 */
export function LeaderboardView({ title, kind, rows, mode, colors, topN, test, lang = 'en', look = 'glass' }: Props) {
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
    body = (
      <section className={`lb-card lb-card--${look}`} aria-label={title}>
        {head}
        <ol className="lb-list">
          {rows.length === 0 && waitingItem}
          {stable(rows).map((r) => (
            <li key={r.key} className={`lb-row lb-row--${r.rank}`} style={{ transform: `translateY(calc(var(--u) * ${(r.rank - 1) * ROW_U}))` }}>
              <span className="lb-rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
              {look === 'pills' && <span className="lb-avatar">{initial(r.name)}</span>}
              <span className="lb-name" dir="auto">{r.name}</span>
              <Score row={r} kind={kind} mode={mode} />
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <div ref={ref} className={`lb lb--${look}`} style={style} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      {body}
    </div>
  );
}
