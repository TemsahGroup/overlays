import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatAdd, formatTime } from '../store';
import type { TimerRules, TimerStyle } from '../types';

export interface TimerAdd {
  id: number;
  seconds: number;
  /** Viewer name, or null for the streamer's own change. */
  name: string | null;
  icon: string;
}

interface Props {
  title: string;
  leftMs: number;
  running: boolean;
  look: TimerStyle;
  colors: [string, string];
  rules: TimerRules;
  showRules: boolean;
  adds: TimerAdd[];
  /** Shows a TEST chip — any timer fed by test events. */
  test: boolean;
  lang?: 'ar' | 'en';
}

const TEXT = {
  en: { over: "Time's up!", paused: 'Paused' },
  ar: { over: 'انتهى الوقت!', paused: 'متوقف' },
};

/** Under this many seconds the time pulses red. */
const WARN_MS = 60_000;

function rulesLine(r: TimerRules): string[] {
  return [
    r.perCoin ? `🪙 1 = ${formatAdd(r.perCoin)}` : '',
    r.perFollow ? `👥 ${formatAdd(r.perFollow)}` : '',
    r.perShare ? `🔁 ${formatAdd(r.perShare)}` : '',
    r.per100Likes ? `❤️ 100 = ${formatAdd(r.per100Likes)}` : '',
  ].filter(Boolean);
}

/**
 * Transparent countdown in one of several looks. Viewers' additions float up
 * from the time as "+30s name".
 */
export function TimerView({ title, leftMs, running, look, colors, rules, showRules, adds, test, lang = 'en' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(5);
  const t = TEXT[lang];

  useEffect(() => {
    const el = ref.current!;
    const update = () => setUnit(Math.max(1, Math.min(el.clientWidth / 100, el.clientHeight / 46)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const over = leftMs <= 0;
  const warn = !over && running && leftMs <= WARN_MS;
  const time = formatTime(leftMs);
  const rulesItems = rulesLine(rules);
  const style = { '--u': `${unit}px`, '--timer-a': colors[0], '--timer-b': colors[1] } as CSSProperties;

  return (
    <div
      ref={ref}
      className={`timer timer--${look} ${over ? 'is-over' : ''} ${warn ? 'is-warn' : ''} ${!running && !over ? 'is-paused' : ''}`}
      style={style}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <section className="timer-card">
        <header className="timer-head">
          <span className="timer-title">{title}</span>
          {!running && !over && <span className="timer-chip">⏸ {t.paused}</span>}
          {test && <span className="timer-test">TEST</span>}
        </header>
        <div className="timer-time" dir="ltr">
          {over ? (
            <span className="timer-over">⏰ {t.over}</span>
          ) : look === 'flip' ? (
            Array.from(time).map((ch, i) =>
              ch === ':' ? (
                <span key={`c${i}`} className="timer-colon">
                  :
                </span>
              ) : (
                <span key={`${i}-${ch}`} className="timer-digit">
                  {ch}
                </span>
              ),
            )
          ) : (
            <span className="timer-digits">{time}</span>
          )}
          <span className="timer-adds" aria-live="polite">
            {adds.map((a) => (
              <span key={a.id} className={`timer-add ${a.seconds < 0 ? 'is-minus' : ''}`}>
                {a.icon} {formatAdd(a.seconds)}
                {a.name && (
                  <small dir="auto">
                    {' '}
                    {a.name}
                  </small>
                )}
              </span>
            ))}
          </span>
        </div>
        {showRules && rulesItems.length > 0 && (
          <footer className="timer-rules" dir="ltr">
            {rulesItems.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </footer>
        )}
      </section>
    </div>
  );
}
