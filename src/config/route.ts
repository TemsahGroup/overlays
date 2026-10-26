// Everything the page needs to know from its URL.
//
//   /                                   dashboard (preview + simulator)
//   /?overlay=1                         all effects, transparent, no controls
//   /?overlay=1&effect=gift             only the Gift Alert
//   /?overlay=1&effect=follow,like      several effects in one source
//   /?overlay=1&effect=like&count=90    per-effect settings (see effects/settings.ts)
//   /?overlay=1&snow=1&density=300      ambient snow layer (see config/settings.ts)
//   /?overlay=1&demo=1                  random MOCK events for layout tests
//   /?overlay=1&badge=0                 hide the TEST chip on simulated alerts
//   /?overlay=1&trigger=follow&t.user=x play one event on load (integrations/tikfinity)

import { parseConfig as parseSnow, type SnowSettings } from './settings';
import { parseEffectList, parseSettings } from '../effects/settings';
import type { EffectId, EffectSettings } from '../effects/types';
import { readUrlTrigger, type BridgeEventInput } from '../integrations/tikfinity';

export interface RouteConfig {
  overlay: boolean;
  effects: EffectId[];
  settings: Record<EffectId, EffectSettings>;
  snow: boolean;
  snowSettings: SnowSettings;
  demo: boolean;
  testBadge: boolean;
  trigger: BridgeEventInput | null;
}

const flag = (p: URLSearchParams, key: string, fallback: boolean) => {
  const raw = p.get(key);
  if (raw === null) return fallback;
  return raw !== '0' && raw.toLowerCase() !== 'false';
};

export function parseRoute(search: string = window.location.search): RouteConfig {
  const p = new URLSearchParams(search);
  const effects = parseEffectList(p.get('effect'));
  return {
    overlay: flag(p, 'overlay', false),
    effects,
    settings: parseSettings(p, effects),
    snow: flag(p, 'snow', false),
    snowSettings: parseSnow(search).snow,
    demo: flag(p, 'demo', false),
    testBadge: flag(p, 'badge', true),
    trigger: readUrlTrigger(search),
  };
}
