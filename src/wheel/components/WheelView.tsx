import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WheelSegment, WheelStyle } from '../types';

export interface WheelResult {
  id: number;
  index: number;
  /** Who earned the spin; null for a manual spin. */
  user: string | null;
}

interface Props {
  title: string;
  segments: WheelSegment[];
  look: WheelStyle;
  /** Current rotation in degrees (grows forever; only the change animates). */
  rotation: number;
  spinning: boolean;
  spinSeconds: number;
  result: WheelResult | null;
  /** Spins waiting after the current one. */
  queued: number;
  hubIcon: string;
  /** false hides the wheel (hide-when-idle). */
  visible: boolean;
  /** Shows a TEST chip — any wheel spun by test events. */
  test: boolean;
  lang?: 'ar' | 'en';
}

const TEXT = {
  en: { queued: '+{n} spins waiting', manual: 'Spin' },
  ar: { queued: '+{n} لفّات مستنية', manual: 'لفّة' },
};

const R = 46;
const BULBS = 24;
const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(3)} ${(-r * Math.cos(a)).toFixed(3)}`;
};

function slicePath(i: number, count: number): string {
  const w = 360 / count;
  return `M0 0 L${point(i * w, R)} A${R} ${R} 0 ${w > 180 ? 1 : 0} 1 ${point((i + 1) * w, R)} Z`;
}

/** Shortens labels to what fits along the radius for this many slices. */
function fit(label: string, count: number): string {
  const max = count <= 4 ? 16 : count <= 6 ? 14 : count <= 8 ? 12 : 10;
  const chars = Array.from(label);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : label;
}

/**
 * Wheel of fortune drawn as SVG. The parent decides the winner and the
 * rotation; this view animates to it and shows the result underneath.
 */
export function WheelView({ title, segments, look, rotation, spinning, spinSeconds, result, queued, hubIcon, visible, test, lang = 'en' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(5);
  const count = segments.length;
  const w = 360 / count;
  const fontSize = count <= 4 ? 5.6 : count <= 6 ? 5 : count <= 8 ? 4.4 : 3.6;
  const t = TEXT[lang];

  useEffect(() => {
    const el = ref.current!;
    const update = () => setUnit(Math.max(1, Math.min(el.clientWidth / 100, el.clientHeight / 132)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const won = result ? segments[result.index] : null;
  const style = { '--u': `${unit}px` } as CSSProperties;

  return (
    <div ref={ref} className={`wheel wheel--${look} ${visible ? '' : 'is-hidden'} ${spinning ? 'is-spinning' : ''}`} style={style} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <div className="wheel-stage">
        <header className="wheel-head">
          <span className="wheel-title">{title}</span>
          {test && <span className="wheel-test">TEST</span>}
        </header>
        <svg className="wheel-svg" viewBox="-55 -55 110 110" aria-hidden="true">
          <circle className="wheel-rim" r="50" />
          <g className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${spinSeconds}s cubic-bezier(0.12, 0.72, 0.08, 1)` : 'none' }}>
            {segments.map((s, i) => (
              <path key={i} className={`wheel-slice ${result && !spinning && result.index === i ? 'is-won' : ''}`} d={slicePath(i, count)} style={{ '--slice': s.color } as CSSProperties} />
            ))}
            {segments.map((s, i) => {
              const center = (i + 0.5) * w;
              // Labels on the left half are turned the other way so they never read upside down.
              const turn = center > 180 ? 90 : -90;
              return (
                <g key={`l${i}`} transform={`rotate(${center})`}>
                  <text className="wheel-label" transform={`translate(0 -26) rotate(${turn})`} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">
                    {fit(s.label, count)}
                  </text>
                </g>
              );
            })}
          </g>
          {look === 'casino' &&
            Array.from({ length: BULBS }, (_, i) => {
              const [x, y] = point((i * 360) / BULBS, 48).split(' ');
              return <circle key={i} className={`wheel-bulb ${i % 2 ? 'is-odd' : ''}`} cx={x} cy={y} r="1.5" />;
            })}
          <circle className="wheel-hub" r="9" />
          <text className="wheel-hub-icon" fontSize="9" textAnchor="middle" dominantBaseline="central">
            {hubIcon}
          </text>
          <path className="wheel-pointer" d="M-5.5 -54 L5.5 -54 L0 -41 Z" />
        </svg>
        <div className="wheel-result-slot">
          {won && result && !spinning && (
            <div key={result.id} className="wheel-result" style={{ '--slice': won.color } as CSSProperties}>
              <span className="wheel-result-user" dir="auto">
                🎉 {result.user ?? t.manual}
              </span>
              <b className="wheel-result-label" dir="auto">
                {won.label}
              </b>
            </div>
          )}
          {queued > 0 && <span className="wheel-queue">{t.queued.replace('{n}', String(queued))}</span>}
        </div>
      </div>
    </div>
  );
}
