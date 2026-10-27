// Maps OverlayEvents to effects and turns effect settings into particle bursts
// and alert cards. Add a new effect here + in types.ts/settings.ts.

import { displayName, type OverlayEvent } from '../events/types';
import type { BurstConfig, EffectId, EffectSettings } from './types';
import type { HeroConfig } from './hero/HeroEffect';

export interface EffectPlay {
  effectId: EffectId;
  event: OverlayEvent;
  bursts: BurstConfig[];
  /** Alert card text, or null when the effect's message is empty. */
  message: string | null;
  icon: string;
  accent: string;
  duration: number;
  /** Queued plays wait for the previous one; instant plays overlap. */
  mode: 'queue' | 'instant';
  /** Optional giant centre icon with rays/shockwave (gift builder "hero" effects). */
  hero?: HeroConfig;
}

const matches = (filter: string, value: string) =>
  filter.trim() === '*' || filter.trim().toLowerCase() === value.trim().toLowerCase();

/** Which effect (if any) should react to this event. */
export function effectForEvent(event: OverlayEvent, settings: Record<EffectId, EffectSettings>): EffectId | null {
  switch (event.type) {
    case 'gift':
      return matches(settings.gift.filter, event.giftName) ? 'gift' : null;
    case 'follow':
      return 'follow';
    case 'like':
      return 'like';
    case 'custom':
      return matches(settings.custom.filter, event.name) ? 'custom' : null;
  }
}

export function formatMessage(template: string, event: OverlayEvent): string {
  const values: Record<string, string> = {
    user: displayName(event.user),
    gift: event.type === 'gift' ? event.giftName : '',
    count: event.type === 'gift' ? String(event.repeatCount) : '1',
    likes: event.type === 'like' ? String(event.likeCount) : '',
    name: event.type === 'custom' ? event.name : event.type,
  };
  return template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);
}

export function buildPlay(effectId: EffectId, s: EffectSettings, event: OverlayEvent): EffectPlay {
  const main: BurstConfig = {
    shapes: [s.shape],
    colors: s.colors,
    count: s.count,
    size: s.size,
    emitter: s.emitter,
    duration: s.duration,
    emitOver: s.duration * 0.45,
  };
  const bursts: BurstConfig[] = [main];

  switch (effectId) {
    case 'gift': {
      // Bigger combos throw more roses (capped so a ×99 combo stays smooth).
      const combo = event.type === 'gift' ? Math.min(event.repeatCount, 5) : 1;
      main.count = Math.round(s.count * (1 + (combo - 1) * 0.5));
      main.emitOver = s.duration * 0.35;
      // Petals drifting down in the gift colours complete the rose shower.
      bursts.push({ ...main, shapes: ['petal'], emitter: 'rain', count: Math.round(main.count * 1.4), size: s.size * 0.45, emitOver: s.duration * 0.5 });
      break;
    }
    case 'follow':
      bursts.push({ ...main, shapes: ['sparkle'], count: Math.round(s.count * 0.6), size: s.size * 0.45 });
      break;
    case 'like': {
      // More likes → bigger burst, within limits.
      const likes = event.type === 'like' ? event.likeCount : 1;
      main.count = Math.round(s.count * Math.min(1 + Math.log10(likes) * 0.5, 2.5));
      main.shapes = [s.shape, s.shape, 'circle'];
      main.emitOver = Math.min(400, s.duration * 0.2);
      break;
    }
    case 'custom':
      main.shapes = [s.shape, 'sparkle'];
      main.emitOver = Math.min(250, s.duration * 0.1);
      break;
  }

  return {
    effectId,
    event,
    bursts,
    message: s.message.trim() ? formatMessage(s.message, event) : null,
    icon: s.icon,
    accent: s.colors[0] ?? '#ff2d55',
    duration: s.duration,
    mode: effectId === 'like' ? 'instant' : 'queue',
  };
}
