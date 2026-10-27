import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { goalState } from '../store';
import type { GoalMetric, GoalStyle } from '../types';

interface Props {
  title: string;
  metric: GoalMetric;
  /** Coins goals fall back to counting gifts when a gift had no value. */
  mode: 'coins' | 'count';
  value: number;
  target: number;
  autoNext: boolean;
  look: GoalStyle;
  colors: [string, string];
  /** Shows a TEST DATA chip — any bar fed by test events. */
  test: boolean;
  lang?: 'ar' | 'en';
}

const TEXT = {
  en: { done: 'Goal reached!', next: 'Goal #{n}' },
  ar: { done: 'وصلنا للهدف!', next: 'الهدف #{n}' },
};

// Box size of each look in units (1u = the board's scale unit).
const BOX: Record<GoalStyle, [number, number]> = {
  classic: [100, 26],
  neon: [100, 26],
  liquid: [100, 28],
  segments: [100, 26],
  battery: [100, 30],
  ring: [60, 76],
};

const SEGMENTS = 10;
const CONFETTI = ['🎉', '✨', '🎊', '⭐', '💥', '🎉', '✨', '🎊', '⭐', '💥', '🎉', '✨'];
const full = new Intl.NumberFormat('en');
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const fmt = (n: number) => (n >= 100_000 ? compact.format(n) : full.format(n));

export function metricIcon(metric: GoalMetric, mode: 'coins' | 'count'): string {
  if (metric === 'likes') return '❤️';
  if (metric === 'follows') return '👥';
  if (metric === 'shares') return '🔁';
  return mode === 'coins' ? '🪙' : '🎁';
}

/**
 * Transparent goal bar in one of several looks. Reaching a goal plays a
 * short celebration; with auto-next the bar restarts toward the next goal.
 */
export function GoalView({ title, metric, mode, value, target, autoNext, look, colors, test, lang = 'en' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(5);
  const state = goalState(value, target, autoNext);
  const t = TEXT[lang];

  useEffect(() => {
    const el = ref.current!;
    const [w, h] = BOX[look];
    const update = () => setUnit(Math.max(1, Math.min(el.clientWidth / w, el.clientHeight / h)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [look]);

  // Celebrate when a goal is reached — not when the page opens on a finished goal.
  const reached = autoNext ? state.level : state.done ? 1 : 0;
  const prevReached = useRef(reached);
  const [party, setParty] = useState(0);
  useEffect(() => {
    if (reached > prevReached.current) setParty(Date.now());
    prevReached.current = reached;
  }, [reached]);
  useEffect(() => {
    if (!party) return;
    const timer = setTimeout(() => setParty(0), 3800);
    return () => clearTimeout(timer);
  }, [party]);

  const pct = Math.round(state.ratio * 100);
  const icon = metricIcon(metric, mode);
  const style = { '--u': `${unit}px`, '--goal-a': colors[0], '--goal-b': colors[1], '--ratio': state.ratio } as CSSProperties;
  const numbers = (
    <span key={value} className="goal-numbers" dir="ltr">
      {fmt(value)} / {fmt(state.goal)} <span className="goal-unit">{icon}</span>
    </span>
  );

  let meter;
  if (look === 'ring') {
    const c = 2 * Math.PI * 42;
    meter = (
      <div className="goal-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="goal-ring-track" cx="50" cy="50" r="42" />
          <circle className="goal-ring-fill" cx="50" cy="50" r="42" strokeDasharray={c} strokeDashoffset={c * (1 - state.ratio)} />
        </svg>
        <div className="goal-ring-center">
          <span className="goal-ring-icon">{icon}</span>
          <b className="goal-pct">{pct}%</b>
          {numbers}
        </div>
      </div>
    );
  } else if (look === 'segments') {
    meter = (
      <div className="goal-track goal-track--segments">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className="goal-seg">
            <span className="goal-seg-fill" style={{ width: `${Math.max(0, Math.min(1, state.ratio * SEGMENTS - i)) * 100}%` }} />
          </span>
        ))}
      </div>
    );
  } else {
    meter = (
      <div className="goal-track">
        <div className="goal-fill" style={{ width: `${state.ratio * 100}%` }}>
          {look === 'liquid' && <span className="goal-wave" />}
        </div>
        {look !== 'battery' && numbers}
        {look === 'battery' && <span key={value} className="goal-bolt">⚡</span>}
      </div>
    );
  }

  return (
    <div ref={ref} className={`goal goal--${look} ${state.done ? 'is-done' : ''}`} style={style} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <section className="goal-card">
        <header className="goal-head">
          {look !== 'ring' && <span className="goal-icon">{icon}</span>}
          <span className="goal-title">{title}</span>
          {autoNext && state.level > 1 && <span className="goal-level">{t.next.replace('{n}', String(state.level))}</span>}
          {look !== 'ring' && <span className="goal-pct">{state.done ? '✓' : `${pct}%`}</span>}
          {test && <span className="goal-test">TEST</span>}
        </header>
        {meter}
        {(look === 'segments' || look === 'battery') && <div className="goal-foot">{numbers}</div>}
      </section>
      {party > 0 && (
        <div key={party} className="goal-party" aria-live="polite">
          <span className="goal-party-text">🎉 {t.done}</span>
          {CONFETTI.map((e, i) => (
            <span
              key={i}
              className="goal-confetti"
              // Offsets are computed here: older OBS browsers have no CSS cos()/sin().
              style={{ '--i': i, '--dx': Math.cos((i * Math.PI) / 6) * 40, '--dy': Math.sin((i * Math.PI) / 6) * 14 } as CSSProperties}
            >
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
