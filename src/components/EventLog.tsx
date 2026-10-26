import { displayName, type OverlayEvent } from '../events/types';

function describe(e: OverlayEvent): string {
  switch (e.type) {
    case 'gift':
      return `sent ${e.giftName} ×${e.repeatCount}`;
    case 'follow':
      return 'followed';
    case 'like':
      return `sent ${e.likeCount} likes`;
    case 'custom':
      return `custom: ${e.name}`;
  }
}

const SOURCE_LABEL: Record<OverlayEvent['source'], string> = {
  mock: 'MOCK',
  url: 'URL TEST',
  tikfinity: 'TIKFINITY',
};

export function EventLog({ events }: { events: OverlayEvent[] }) {
  if (!events.length) return <p className="hint">No events yet. Press a button above.</p>;
  return (
    <ul className="log">
      {events.map((e) => (
        <li key={e.id + (e.relayed ? '-r' : '')}>
          <span className={`chip chip--${e.source}`}>{SOURCE_LABEL[e.source]}</span>
          <span className="log-text">
            <b>{displayName(e.user)}</b> {describe(e)}
          </span>
          <time>{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
        </li>
      ))}
    </ul>
  );
}
