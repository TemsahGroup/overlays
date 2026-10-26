import type { SnowSettings } from '../../config/settings';
import type { EffectTrigger, OverlayEffect } from '../../engine/types';
import { createCrispSprite, createSoftSprite } from './sprite';

const REFERENCE_AREA = 1920 * 1080;
const BASE_FALL = 70; // px/s for the farthest flake at speed 1
const MAX_BURST = 1500;

interface Flake {
  x: number;
  y: number;
  /** 0 = far away (small, slow, faint) … 1 = close (big, fast, bright). */
  depth: number;
  radius: number;
  fall: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  alpha: number;
  soft: boolean;
  /** Stable 0..1 random value for per-flake size/speed variation. */
  seed: number;
  /** Burst flakes are not recycled once they leave the screen. */
  transient: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export class SnowEffect implements OverlayEffect {
  readonly id = 'snow';
  private flakes: Flake[] = [];
  private width = 0;
  private height = 0;
  private settings: SnowSettings;
  private crisp = createCrispSprite();
  private soft = createSoftSprite();
  private gust = 0;

  constructor(settings: SnowSettings) {
    this.settings = { ...settings };
  }

  setSettings(settings: SnowSettings): void {
    this.settings = { ...settings };
    this.syncCount();
  }

  resize(width: number, height: number): void {
    // Keep flakes in place proportionally so a resize does not cause a jump.
    if (this.width > 1 && this.height > 1) {
      const sx = width / this.width;
      const sy = height / this.height;
      this.flakes.forEach((f) => {
        f.x *= sx;
        f.y *= sy;
      });
    }
    this.width = width;
    this.height = height;
    // Space gained by a resize is filled immediately, not from the top.
    this.syncCount(true);
  }

  count(): number {
    return this.flakes.length;
  }

  handle(trigger: EffectTrigger): boolean {
    if (trigger.name !== 'snow:burst') return false;
    const requested = Number(trigger.payload?.amount ?? 200);
    const amount = Math.min(Math.max(0, requested), MAX_BURST - this.transientCount());
    for (let i = 0; i < amount; i++) {
      // Start above the screen, spread vertically so they arrive as a flurry.
      this.flakes.push(this.createFlake(rand(-this.height * 0.6, -10), true));
    }
    return true;
  }

  update(dt: number, time: number): void {
    const { speed, wind } = this.settings;
    // Slow, layered sine waves give natural-feeling gusts without a noise lib.
    this.gust = Math.sin(time * 0.23) * 0.6 + Math.sin(time * 0.61 + 1.3) * 0.3;
    const windPx = (wind + this.gust * 0.35) * 40;
    const w = this.width;
    const h = this.height;

    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i];
      f.phase += f.swayFreq * dt;
      f.y += f.fall * speed * dt;
      // Closer flakes are pushed more by the wind (parallax).
      f.x += (Math.sin(f.phase) * f.swayAmp + windPx * (0.4 + f.depth)) * dt;

      const margin = f.radius * 2;
      if (f.x > w + margin) f.x = -margin;
      else if (f.x < -margin) f.x = w + margin;

      if (f.y > h + margin) {
        if (f.transient) {
          this.flakes.splice(i, 1);
        } else {
          this.respawn(f, -margin);
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const f of this.flakes) {
      const d = f.radius * 2;
      ctx.globalAlpha = f.alpha;
      ctx.drawImage(f.soft ? this.soft : this.crisp, f.x - f.radius, f.y - f.radius, d, d);
    }
    ctx.globalAlpha = 1;
  }

  dispose(): void {
    this.flakes = [];
  }

  private targetCount(): number {
    if (!this.width || !this.height) return 0;
    return Math.round((this.settings.density * this.width * this.height) / REFERENCE_AREA);
  }

  private transientCount(): number {
    return this.flakes.reduce((n, f) => n + (f.transient ? 1 : 0), 0);
  }

  /** Add or remove persistent flakes to match the density setting. */
  private syncCount(scatter = false): void {
    const persistent = this.flakes.filter((f) => !f.transient);
    const target = this.targetCount();
    if (persistent.length < target) {
      for (let i = persistent.length; i < target; i++) {
        // Resizes scatter over the whole screen; density increases enter from above.
        const y = scatter ? rand(0, this.height) : rand(-this.height * 0.5, -10);
        this.flakes.push(this.createFlake(y, false));
      }
    } else if (persistent.length > target) {
      let toRemove = persistent.length - target;
      this.flakes = this.flakes.filter((f) => f.transient || toRemove-- <= 0);
    }
    // Re-apply size to existing flakes so the slider responds immediately.
    this.flakes.forEach((f) => this.applyDepth(f));
  }

  private createFlake(y: number, transient: boolean): Flake {
    const flake: Flake = {
      x: rand(0, this.width),
      y,
      // Bias toward distant flakes: most snow is small and far away.
      depth: Math.pow(Math.random(), 1.8),
      radius: 0,
      fall: 0,
      swayAmp: rand(8, 30),
      swayFreq: rand(0.6, 1.8),
      phase: rand(0, Math.PI * 2),
      alpha: 0,
      soft: false,
      seed: Math.random(),
      transient,
    };
    this.applyDepth(flake);
    return flake;
  }

  private applyDepth(f: Flake): void {
    const jitter = 0.85 + f.seed * 0.3;
    f.radius = (1.2 + f.depth * 6.5) * this.settings.size * jitter;
    f.fall = BASE_FALL * (0.55 + f.depth * 1.6) * jitter;
    f.alpha = 0.45 + f.depth * 0.5;
    f.soft = f.depth > 0.78;
  }

  private respawn(f: Flake, y: number): void {
    f.x = rand(0, this.width);
    f.y = y;
    f.phase = rand(0, Math.PI * 2);
  }
}
