import type { EffectTrigger, EngineStats, OverlayEffect } from './types';

const MAX_DT = 0.05; // avoid huge jumps after the tab was hidden
const MAX_DPR = 2; // cap backing-store size for performance

/**
 * Owns one transparent <canvas>, a single requestAnimationFrame loop and a
 * list of effects. Framework-agnostic: React only creates and disposes it.
 */
export class OverlayEngine {
  private ctx: CanvasRenderingContext2D;
  private effects: OverlayEffect[] = [];
  private rafId = 0;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private resizeObserver: ResizeObserver;
  private frames = 0;
  private statsTime = 0;
  private shakeUntil = 0;
  private shakeMs = 0;
  private shakePx = 0;

  onStats?: (stats: EngineStats) => void;

  constructor(private canvas: HTMLCanvasElement) {
    // alpha: true is the default, stated explicitly: the canvas must stay transparent.
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  /** `behind: true` draws the effect under the existing ones (e.g. ambient snow). */
  add(effect: OverlayEffect, behind = false): void {
    if (behind) this.effects.unshift(effect);
    else this.effects.push(effect);
    effect.resize(this.width, this.height);
  }

  remove(id: string): void {
    this.effects = this.effects.filter((e) => {
      if (e.id === id) e.dispose?.();
      return e.id !== id;
    });
  }

  /** Shakes everything on the canvas for a moment (skipped for reduced motion). */
  shake(px: number, ms: number): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.shakePx = px;
    this.shakeMs = ms;
    this.shakeUntil = performance.now() + ms;
  }

  /** Forward a trigger to every effect until one handles it. */
  trigger(trigger: EffectTrigger): boolean {
    return this.effects.some((e) => e.handle?.(trigger) ?? false);
  }

  start(): void {
    if (this.rafId) return;
    this.lastTime = performance.now();
    this.statsTime = this.lastTime;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.effects.forEach((e) => e.dispose?.());
    this.effects = [];
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.effects.forEach((e) => e.resize(this.width, this.height));
  }

  private loop = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    const time = now / 1000;

    this.ctx.clearRect(0, 0, this.width, this.height);
    const shaking = now < this.shakeUntil;
    if (shaking) {
      const k = ((this.shakeUntil - now) / this.shakeMs) * this.shakePx;
      this.ctx.save();
      this.ctx.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
    }
    for (const effect of this.effects) {
      effect.update(dt, time);
      effect.draw(this.ctx);
    }
    if (shaking) this.ctx.restore();

    this.frames++;
    if (this.onStats && now - this.statsTime >= 500) {
      const particles = this.effects.reduce((n, e) => n + (e.count?.() ?? 0), 0);
      this.onStats({ fps: Math.round((this.frames * 1000) / (now - this.statsTime)), particles });
      this.frames = 0;
      this.statsTime = now;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
