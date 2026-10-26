import type { EffectPlay } from '../effects/registry';
import { displayName, type OverlayEvent } from '../events/types';
import { getBuilderEffect } from './effects';
import { matchMapping } from './giftEvents';
import type { GiftMapping, PublicOverlayConfig } from './types';

export function formatAlert(template: string, event: OverlayEvent, mapping: GiftMapping): string {
  const values: Record<string, string> = {
    user: displayName(event.user),
    gift: event.type === 'gift' ? event.giftName : mapping.selectedGiftName,
    count: event.type === 'gift' ? String(event.repeatCount) : '1',
  };
  return template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m);
}

/** Turns a mapping + event into a play for the existing OverlayStage. */
export function buildMappingPlay(mapping: GiftMapping, event: OverlayEvent): EffectPlay {
  const s = mapping.effectSettings;
  const { alertSettings: alert } = mapping;
  return {
    // 'gift' reuses the existing gift card style and queueing behaviour.
    effectId: 'gift',
    event,
    bursts: getBuilderEffect(mapping.effectId).build(s, event),
    message: alert.enabled && alert.text.trim() ? formatAlert(alert.text, event, mapping) : null,
    icon: alert.icon || '🎁',
    accent: s.colors[0] ?? '#ff2d55',
    duration: s.duration,
    mode: 'queue',
  };
}

/** resolvePlay for OverlayStage: only gifts matching this configuration play. */
export function resolveConfigPlay(config: PublicOverlayConfig | null) {
  return (event: OverlayEvent): EffectPlay | null => {
    if (!config || !config.enabled) return null;
    const mapping = matchMapping(config, event);
    return mapping ? buildMappingPlay(mapping, event) : null;
  };
}
