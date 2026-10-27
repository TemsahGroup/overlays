import type { OverlayEffect } from '../../engine/types';
import type { BurstConfig, EmitterKind, ShapeKind } from '../types';
import { getSprite, SPRITE_SCALE } from './sprites';

const MAX_PARTICLES = 2500;

/** Shapes that should stay roughly upright and only sway (no tumbling). */
const UPRIGHT = new Set<ShapeKind>(['rose', 'heart', 'lantern', 'balloon', 'crescent', 'emoji']);
/** Objects that swing like a pendulum (never turn sideways). */
const SWINGING = new Set<ShapeKind>(['lantern', 'balloon', 'crescent', 'gem']);
/** Flat shapes that flip in 3D while falling. */
const FLIPPING = new Set<ShapeKind>(['confetti', 'petal', 'coin']);

interface Particle {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  /** Velocity damping per second (0 = none). */
  drag: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  rot: number;
  spin: number;
  /** Confetti/petals flip in 3D: scaleY oscillates. */
  flip: boolean;
  /** Hanging/floating objects swing around rot0 instead of spinning. */
  pendulum: boolean;
  rot0: number;
  size: number;
  age: number;
  life: number;
}

interface PendingBurst {
  config: BurstConfig;
  spawned: number;
  elapsed: number;
  /** Shared origin for 'point' bursts. */
  origin: { x: number; y: number };
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Smooth pop-in: 0 → ~1.12 → 1 over the first 0.35 s. */
function popScale(age: number): number {
  const t = Math.min(age / 0.35, 1);
  const c = 1.70158 * 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

/**
 * Generic particle renderer. Effects describe *what* to emit (BurstConfig);
 * this class handles spawning, physics and drawing for all of them.
 */
export class ParticleSystem implements OverlayEffect {
  readonly id = 'particles';
  private particles: Particle[] = [];
  private pending: PendingBurst[] = [];
  private width = 0;
  private height = 0;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  count(): number {
    return this.particles.length;
  }

  play(config: BurstConfig): void {
    if (config.count <= 0 || !config.shapes.length || !config.colors.length) return;
    const origin = config.origin
      ? { x: this.width * config.origin.x, y: this.height * config.origin.y }
      : { x: this.width * rand(0.62, 0.85), y: this.height * rand(0.62, 0.8) };
    this.pending.push({ config, spawned: 0, elapsed: -(config.delay ?? 0), origin });
  }

  clear(): void {
    this.particles = [];
    this.pending = [];
  }

  update(dt: number): void {
    // Spawn particles of active bursts, spread over `emitOver`.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const b = this.pending[i];
      b.elapsed += dt * 1000;
      if (b.elapsed < 0) continue; // delayed burst has not started yet
      const progress = b.config.emitOver > 0 ? Math.min(b.elapsed / b.config.emitOver, 1) : 1;
      const due = Math.round(b.config.count * progress);
      for (; b.spawned < due; b.spawned++) {
        if (this.particles.length < MAX_PARTICLES) this.particles.push(this.spawn(b));
      }
      if (b.spawned >= b.config.count) this.pending.splice(i, 1);
    }

    const h = this.height;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.gravity * dt;
      p.phase += p.swayFreq * dt;
      p.x += (p.vx + Math.cos(p.phase) * p.swayAmp) * dt;
      p.y += p.vy * dt;
      if (p.pendulum) p.rot = p.rot0 + Math.sin(p.phase) * 0.22;
      else p.rot += p.spin * dt;

      const offscreen = (p.vy > 0 && p.y > h + p.size * 2) || (p.vy < 0 && p.gravity <= 0 && p.y < -p.size * 2);
      if (p.age >= p.life || offscreen) this.particles.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const fadeIn = Math.min(p.age / 0.12, 1);
      const fadeOut = Math.min((p.life - p.age) / (p.life * 0.28), 1);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
      if (alpha <= 0) continue;
      const s = p.size * SPRITE_SCALE * popScale(p.age);
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.flip) ctx.scale(1, Math.cos(p.phase * 2.2));
      ctx.drawImage(p.sprite, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  dispose(): void {
    this.clear();
  }

  private spawn(b: PendingBurst): Particle {
    const { config } = b;
    const shape = pick(config.shapes);
    const size = config.size * rand(0.7, 1.3);
    const lifeBase = config.duration / 1000;
    const upright = UPRIGHT.has(shape);
    const p: Particle = {
      sprite: getSprite(shape, pick(config.colors), shape === 'emoji' ? pick(config.emoji?.length ? config.emoji : ['✨']) : undefined),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 0,
      drag: 0,
      swayAmp: 0,
      swayFreq: rand(1, 2.4),
      phase: rand(0, Math.PI * 2),
      rot: upright ? rand(-0.35, 0.35) : rand(0, Math.PI * 2),
      spin: upright ? rand(-0.8, 0.8) : rand(-4, 4),
      flip: FLIPPING.has(shape),
      pendulum: SWINGING.has(shape),
      rot0: rand(-0.12, 0.12),
      size,
      age: 0,
      life: lifeBase * rand(0.75, 1),
    };
    this.applyEmitter(p, config.emitter, b.origin, config.origin !== undefined);
    if (config.speedScale && config.speedScale !== 1) {
      p.vx *= config.speedScale;
      p.vy *= config.speedScale;
      p.gravity *= config.speedScale;
      p.life /= Math.max(config.speedScale, 0.3);
    }
    return p;
  }

  private applyEmitter(p: Particle, emitter: EmitterKind, origin: { x: number; y: number }, customOrigin: boolean): void {
    const w = this.width;
    const h = this.height;
    const unit = Math.min(w, h);

    switch (emitter) {
      case 'fountain': {
        const g = h * 1.1;
        const apex = h * rand(0.35, 0.8); // how high it flies
        p.x = w * rand(0.2, 0.8);
        p.y = h + p.size;
        p.vy = -Math.sqrt(2 * g * apex);
        p.vx = rand(-1, 1) * w * 0.12;
        p.gravity = g;
        p.life = Math.max(p.life, 2.8);
        break;
      }
      case 'float':
        p.x = w * rand(0.05, 0.95);
        p.y = h + p.size * rand(1, 4);
        p.vy = -h * rand(0.22, 0.42);
        p.vx = rand(-20, 20);
        p.gravity = -h * 0.02;
        p.swayAmp = rand(30, 70);
        break;
      case 'rain':
        p.x = w * rand(0, 1);
        p.y = -p.size * rand(1, 3);
        p.vy = h * rand(0.18, 0.32);
        p.vx = rand(-30, 30);
        p.gravity = h * 0.03;
        p.swayAmp = rand(25, 60);
        break;
      case 'burst': {
        const a = rand(0, Math.PI * 2);
        const v = unit * rand(0.5, 1.4);
        p.x = (customOrigin ? origin.x : w / 2) + rand(-10, 10);
        p.y = (customOrigin ? origin.y : h * 0.45) + rand(-10, 10);
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
        p.drag = 2.2;
        p.gravity = h * 0.18;
        break;
      }
      case 'point': {
        const a = -Math.PI / 2 + rand(-0.75, 0.75);
        const v = unit * rand(0.35, 0.95);
        p.x = origin.x + rand(-8, 8);
        p.y = origin.y + rand(-8, 8);
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
        p.drag = 1.6;
        p.gravity = -unit * 0.05;
        p.swayAmp = rand(10, 35);
        break;
      }
      case 'cannons': {
        const left = Math.random() < 0.5;
        const a = (left ? -Math.PI / 3 : (-2 * Math.PI) / 3) + rand(-0.25, 0.25);
        const v = h * rand(1.0, 1.5);
        p.x = left ? -p.size : w + p.size;
        p.y = h * 0.95;
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
        p.drag = 0.9;
        p.gravity = h * 0.55;
        p.swayAmp = rand(10, 40);
        p.life = Math.max(p.life, 3);
        break;
      }
    }
  }
}
