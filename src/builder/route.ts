// Hash routes for the Gift Overlay Builder:
//
//   #/builder                    new configuration
//   #/builder/<id>               edit a saved configuration (owner only)
//   #/overlay/<id>               OBS overlay, config from the repository
//   #/overlay/<id>?c=<data>      portable OBS overlay, public config in the link
//   #/overlay/<id>?demo=1        plays a TEST gift every few seconds (layout check)
//   #/overlay/<id>?live=0        do not connect to TikFinity Desktop
//   #/overlay/<id>?setup=1       show the live connection status panel
//   #/overlay/<id>?diag=1        + payload diagnostics (dev builds only)
//   #/overlay/<id>?tf=<ws-url>   other Event API address (loopback only)
//   #/leaderboards               leaderboard editor (new)
//   #/leaderboards/<id>          edit a saved leaderboard
//   #/leaderboard/<id>?c=<data>  leaderboard OBS overlay (same flags as #/overlay)
//   #/chats, #/chats/<id>        chat overlay editor
//   #/chat/<id>?c=<data>         chat OBS overlay (same flags as #/overlay)
//
// Hash routes keep the existing query-parameter app untouched, need no router
// dependency and work with Vite's relative `base: './'` on any static host.

import { useEffect, useState } from 'react';
import { isValidId } from './validate';
import { isLoopbackWsUrl } from '../integrations/tikfinity/eventApi/parse';

/** Flags shared by every OBS overlay route. */
export interface OverlayFlags {
  id: string;
  portable: string | null;
  demo: boolean;
  live: boolean;
  setup: boolean;
  diag: boolean;
  eventApiUrl: string | null;
  /** Language for on-stream text (?lang=ar|en). */
  lang: 'ar' | 'en' | null;
}

export type BuilderRoute =
  | { page: 'home' }
  | { page: 'builder'; id: string | null }
  | { page: 'leaderboards'; id: string | null }
  | ({ page: 'leaderboard' } & OverlayFlags)
  | { page: 'chats'; id: string | null }
  | ({ page: 'chat' } & OverlayFlags)
  | {
      page: 'overlay';
      id: string;
      portable: string | null;
      demo: boolean;
      live: boolean;
      setup: boolean;
      diag: boolean;
      /** Validated loopback override, or null for the default address. */
      eventApiUrl: string | null;
      lang: 'ar' | 'en' | null;
    };

export function parseHash(hash: string = window.location.hash): BuilderRoute | null {
  if (hash === '#/' || hash === '#') return { page: 'home' };
  const m = hash.match(/^#\/(builder|overlay|leaderboards|leaderboard|chats|chat)(?:\/([^?]*))?(?:\?(.*))?$/);
  if (!m) return null;
  const [, page, rawId, query] = m;
  const id = rawId && isValidId(rawId) ? rawId : null;
  if (page === 'builder' || page === 'leaderboards' || page === 'chats') return { page, id };
  if (!id) return null;
  const params = new URLSearchParams(query ?? '');
  const tf = params.get('tf');
  return {
    page: page === 'leaderboard' ? 'leaderboard' : page === 'chat' ? 'chat' : 'overlay',
    id,
    portable: params.get('c'),
    demo: params.get('demo') === '1',
    live: params.get('live') !== '0',
    setup: params.get('setup') === '1',
    diag: import.meta.env.DEV && params.get('diag') === '1',
    eventApiUrl: tf && isLoopbackWsUrl(tf) ? tf : null,
    lang: params.get('lang') === 'ar' ? 'ar' : params.get('lang') === 'en' ? 'en' : null,
  };
}

export function useHashRoute(): BuilderRoute | null {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Absolute app URL (without hash), works for dev, preview and hosted builds. */
export function appBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function overlayUrl(id: string, portableData?: string): string {
  return `${appBaseUrl()}#/overlay/${id}${portableData ? `?c=${portableData}` : ''}`;
}

export function leaderboardUrl(id: string, portableData?: string, lang?: 'ar' | 'en'): string {
  const params = [portableData ? `c=${portableData}` : '', lang ? `lang=${lang}` : ''].filter(Boolean).join('&');
  return `${appBaseUrl()}#/leaderboard/${id}${params ? `?${params}` : ''}`;
}

export function chatUrl(id: string, portableData?: string, lang?: 'ar' | 'en'): string {
  const params = [portableData ? `c=${portableData}` : '', lang ? `lang=${lang}` : ''].filter(Boolean).join('&');
  return `${appBaseUrl()}#/chat/${id}${params ? `?${params}` : ''}`;
}
