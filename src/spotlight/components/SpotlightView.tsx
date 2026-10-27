import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { giftIcon } from '../../builder/gifts';
import type { SpotlightState } from '../store';
import type { SpotlightItem, SpotlightLayout, SpotlightStyle } from '../types';

interface Props {
  state: SpotlightState;
  items: SpotlightItem[];
  layout: SpotlightLayout;
  rotateSeconds: number;
  look: SpotlightStyle;
  colors: [string, string];
  /** Shows a TEST chip — any bar fed by test events. */
  test: boolean;
  lang?: 'ar' | 'en';
}

const TEXT = {
  en: { lastGift: 'Last gift', biggestGift: 'Biggest gift', lastFollow: 'Last follower', lastShare: 'Last share', waiting: 'Waiting…', thanks: 'Thanks for the follow!', shared: 'Shared the stream' },
  ar: { lastGift: 'آخر داعم', biggestGift: 'أكبر هدية', lastFollow: 'آخر متابع', lastShare: 'آخر مشاركة', waiting: 'في الانتظار…', thanks: 'شكرًا على المتابعة!', shared: 'شارك البث' },
};

const ICONS: Record<SpotlightItem, string> = { lastGift: '🎁', biggestGift: '🥇', lastFollow: '👥', lastShare: '🔁' };
const ROW_U = 16;
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const initial = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase();

interface Row {
  item: SpotlightItem;
  name: string | null;
  detail: string;
  /** Changes whenever the row gets a new value, to replay the highlight. */
  stamp: number;
}

function rowFor(item: SpotlightItem, s: SpotlightState, t: (typeof TEXT)['en']): Row {
  if (item === 'lastGift' || item === 'biggestGift') {
    const g = item === 'lastGift' ? s.lastGift : s.biggestGift;
    if (!g) return { item, name: null, detail: t.waiting, stamp: 0 };
    const value = g.coins !== undefined && !s.missingValue ? ` · 🪙 ${compact.format(g.coins)}` : '';
    return { item, name: g.name, detail: `${giftIcon(g.giftName)} ${g.giftName} ×${g.count}${value}`, stamp: g.at };
  }
  const p = item === 'lastFollow' ? s.lastFollow : s.lastShare;
  if (!p) return { item, name: null, detail: t.waiting, stamp: 0 };
  return { item, name: p.name, detail: item === 'lastFollow' ? t.thanks : t.shared, stamp: p.at };
}

/**
 * Small transparent corner bar: last gift, biggest gift of the stream, last
 * follower and last share — all at once, or one at a time in turn.
 */
export function SpotlightView({ state, items, layout, rotateSeconds, look, colors, test, lang = 'en' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(4);
  const [turn, setTurn] = useState(0);
  const t = TEXT[lang];
  const rows = items.map((item) => rowFor(item, state, t));
  const shown = layout === 'rotate' ? [rows[turn % rows.length]] : rows;

  useEffect(() => {
    const el = ref.current!;
    const lines = layout === 'rotate' ? 1 : items.length;
    const update = () => setUnit(Math.max(1, Math.min(el.clientWidth / 100, el.clientHeight / (lines * ROW_U + 2))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, items.length]);

  useEffect(() => {
    if (layout !== 'rotate' || items.length < 2) return;
    const timer = setInterval(() => setTurn((n) => n + 1), rotateSeconds * 1000);
    return () => clearInterval(timer);
  }, [layout, rotateSeconds, items.length]);

  // A fresh gift or follower jumps to the front while rotating.
  const newest = rows.reduce((best, r, i) => (r.stamp > (rows[best]?.stamp ?? 0) ? i : best), 0);
  const newestStamp = rows[newest]?.stamp ?? 0;
  const seen = useRef(newestStamp);
  useEffect(() => {
    if (layout === 'rotate' && newestStamp > seen.current) setTurn(newest);
    seen.current = newestStamp;
  }, [newestStamp, newest, layout]);

  const style = { '--u': `${unit}px`, '--spot-a': colors[0], '--spot-b': colors[1] } as CSSProperties;
  return (
    <div ref={ref} className={`spot spot--${look} spot--${layout}`} style={style} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <ul className="spot-list">
        {shown.map((r) => (
          <li key={layout === 'rotate' ? `${r.item}-${turn}` : r.item} className={`spot-row spot-row--${r.item} ${r.name ? '' : 'is-empty'}`}>
            <span key={r.stamp} className="spot-flash" />
            <span className="spot-label">
              {ICONS[r.item]} {t[r.item]}
            </span>
            {r.name && <span className="spot-avatar">{initial(r.name)}</span>}
            <span className="spot-body">
              {r.name && (
                <b key={r.stamp} className="spot-name" dir="auto">
                  {r.name}
                </b>
              )}
              <span className="spot-detail" dir="auto">
                {r.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {test && <span className="spot-test">TEST</span>}
    </div>
  );
}
