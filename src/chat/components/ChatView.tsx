import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { nameColor, visibleMessages, type ChatMessage } from '../store';
import type { ChatStyle } from '../types';

interface Props {
  messages: ChatMessage[];
  look: ChatStyle;
  colors: [string, string];
  /** Text size in percent. */
  textScale: number;
  showAvatars: boolean;
  fadeSeconds: number;
  /** Shows a TEST DATA chip — any chat fed by test messages. */
  test: boolean;
  lang?: 'ar' | 'en';
}

const initial = (name: string) => (Array.from(name.trim())[0] ?? '?').toUpperCase();

function Avatar({ msg }: { msg: ChatMessage }) {
  const [failed, setFailed] = useState(false);
  if (msg.kind === 'gift') return <span className="chat-avatar chat-avatar--gift">🎁</span>;
  return msg.avatarUrl && !failed ? (
    <img className="chat-avatar" src={msg.avatarUrl} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <span className="chat-avatar" style={{ background: nameColor(msg.userKey) }}>
      {initial(msg.name)}
    </span>
  );
}

/**
 * Transparent chat box in one of several looks. New messages enter at the
 * bottom and push older ones up; with a fade time, old messages fade out.
 */
export function ChatView({ messages, look, colors, textScale, showAvatars, fadeSeconds, test, lang = 'en' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(5);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const el = ref.current!;
    // 1u = 1% of the width, capped so a full-screen source does not get huge text.
    const update = () => setUnit(Math.max(1.5, Math.min(el.clientWidth / 100, el.clientHeight / 50, 7)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (fadeSeconds <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [fadeSeconds]);

  const style = { '--u': `${(unit * textScale) / 100}px`, '--chat-a': colors[0], '--chat-b': colors[1] } as CSSProperties;
  const shown = visibleMessages(messages, fadeSeconds > 0 ? now : 0, fadeSeconds);

  return (
    <div ref={ref} className={`chat chat--${look}`} style={style} dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      {test && <span className="chat-test">TEST DATA</span>}
      <ol className="chat-list">
        {shown.map(({ msg, leaving }, i) => (
          <li
            key={msg.id}
            className={`chat-msg chat-msg--${msg.kind} ${leaving ? 'is-leaving' : ''} ${i === shown.length - 1 ? 'is-newest' : ''}`}
            style={{ '--name': nameColor(msg.userKey) } as CSSProperties}
          >
            {showAvatars && <Avatar msg={msg} />}
            <div className="chat-body">
              <span className="chat-head">
                {msg.moderator && <span className="chat-badge" title="Moderator">🛡️</span>}
                {msg.subscriber && <span className="chat-badge" title="Subscriber">⭐</span>}
                <span className="chat-name" dir="auto">
                  {msg.name}
                </span>
              </span>
              {msg.kind === 'gift' && msg.gift ? (
                <span className="chat-text chat-text--gift" dir="auto">
                  🎁 {msg.gift.name} ×{msg.gift.count}
                </span>
              ) : (
                <span className="chat-text" dir="auto">
                  {msg.text}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
