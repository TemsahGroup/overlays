/** An event sent to effects, e.g. from a future TikTok gift adapter. */
export interface EffectTrigger {
  /** Namespaced name, e.g. "snow:burst". */
  name: string;
  payload?: Record<string, unknown>;
}

/**
 * Anything the engine can render. Effects own their state, the engine owns
 * the canvas, the animation loop and resizing.
 */
export interface OverlayEffect {
  readonly id: string;
  /** Called on start and on every resize, in CSS pixels. */
  resize(width: number, height: number): void;
  /** Advance the simulation. `dt` is in seconds (clamped by the engine). */
  update(dt: number, time: number): void;
  /** Draw onto a context already scaled for devicePixelRatio. */
  draw(ctx: CanvasRenderingContext2D): void;
  /** React to a trigger. Return true if handled. */
  handle?(trigger: EffectTrigger): boolean;
  /** Number of live particles (for the stats readout). */
  count?(): number;
  dispose?(): void;
}

export interface EngineStats {
  fps: number;
  particles: number;
}
