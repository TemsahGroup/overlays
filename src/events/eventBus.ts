// Event bus between event sources and the overlay.
//
//   Mock adapter ─┐
//   URL trigger  ─┼─▶ eventBus ─▶ OverlayStage ─▶ effects
//   TikFinity*   ─┘                (* integration module, not connected)

import type { OverlayEvent } from './types';

type Listener = (event: OverlayEvent) => void;
const listeners = new Set<Listener>();

export function onOverlayEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitOverlayEvent(event: OverlayEvent): void {
  listeners.forEach((fn) => fn(event));
}

export function makeEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
