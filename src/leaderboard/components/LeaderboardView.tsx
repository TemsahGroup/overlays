import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { RankedRow, ScoreMode } from '../store';
import type { LeaderboardKind } from '../types';

interface Props {
  title: string;
  kind: LeaderboardKind;
  rows: RankedRow[];
  mode: ScoreMode;
  colors: [string, string];
  topN: number;
  /** Shows a TEST DATA chip — any board fed by mock/demo events. */
  test: boolean;
}

const HEADER_U = 16;
const ROW_U = 12;
const PAD_U = 5;

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const MEDALS = ['👑', '🥈', '🥉'];

function unitLabel(kind: LeaderboardKind, mode: ScoreMode): string {
  if (kind === 'likers') return '❤️';
  return mode === 'coins' ? '🪙' : '🎁';
}

/**
 * Transparent leaderboard card. Rows are absolutely positioned by rank and
 * transition their transform, so re-ordering animates smoothly (FLIP-style).
 */
export function LeaderboardView({ title, kind, rows, mode, colors, topN, test }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(5);

  // Size everything from the source size: width-driven, capped by height.
  useEffect(() => {
    const el = ref.current!;
    const update = () => {
      const byWidth = el.clientWidth / 100;
      const byHeight = el.clientHeight / (HEADER_U + topN * ROW_U + PAD_U);
      setUnit(Math.max(1, Math.min(byWidth, byHeight)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [topN]);

  const style = { '--u': `${unit}px`, '--lb-a': colors[0], '--lb-b': colors[1], '--rows': topN } as CSSProperties;
  return (
    <div ref={ref} className="lb" style={style}>
      <section className="lb-card" aria-label={title}>
        <header className="lb-head">
          <span className="lb-icon">{kind === 'likers' ? '❤️' : '🏆'}</span>
          <span className="lb-title">{title}</span>
          {test && <span className="lb-test">TEST DATA</span>}
        </header>
        <ol className="lb-list">
          {rows.length === 0 && <li className="lb-empty">{kind === 'likers' ? 'Waiting for likes…' : 'Waiting for gifts…'}</li>}
          {/* Stable DOM order (by key): React never moves a row node, so the
              enter animation does not replay and transform transitions can
              slide rows into their new rank. */}
          {[...rows].sort((a, b) => a.key.localeCompare(b.key)).map((r) => (
            <li key={r.key} className={`lb-row lb-row--${r.rank}`} style={{ transform: `translateY(calc(var(--u) * ${(r.rank - 1) * ROW_U}))` }}>
              <span className="lb-rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
              <span className="lb-name">{r.name}</span>
              <span key={r.score} className="lb-score">
                {compact.format(r.score)} <span className="lb-unit">{unitLabel(kind, mode)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
