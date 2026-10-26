import type { CSSProperties } from 'react';
import type { EffectPlay } from '../effects/registry';
import { isSimulated } from '../events/types';

export interface ActiveAlert {
  key: string;
  play: EffectPlay;
}

const LABELS: Record<EffectPlay['effectId'], (play: EffectPlay) => string> = {
  gift: () => 'Gift',
  follow: () => 'New follower',
  like: () => 'Likes',
  custom: (p) => (p.event.type === 'custom' ? p.event.name : 'Event'),
};

interface Props {
  alerts: ActiveAlert[];
  testBadge: boolean;
}

/** DOM layer for alert cards. Animations are pure CSS (see styles.css). */
export function AlertLayer({ alerts, testBadge }: Props) {
  return (
    <div className="alert-layer" aria-live="polite">
      {alerts.map(({ key, play }) => (
        <div
          key={key}
          className={`alert alert--${play.effectId}`}
          style={{ '--accent': play.accent, '--d': `${play.duration}ms` } as CSSProperties}
        >
          <div className="alert-icon">
            <span>{play.icon}</span>
          </div>
          <div className="alert-body">
            <div className="alert-label">
              {LABELS[play.effectId](play)}
              {testBadge && isSimulated(play.event) && <span className="alert-test">TEST</span>}
            </div>
            <div className="alert-text">{play.message}</div>
          </div>
          <div className="alert-shine" />
        </div>
      ))}
    </div>
  );
}
