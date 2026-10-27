// "Hero moment": a giant icon (usually the gift's emoji) flies to the centre,
// lands with a shockwave and light rays, holds with a gentle pulse, then
// zooms out. Particle bursts that accompany it are regular BurstConfigs.

import type { OverlayEffect } from '../../engine/types';

export interface HeroConfig {
  /** Emoji drawn big in the centre, e.g. the gift icon. */
  icon: string;
  colors: string[];
  /** Total length in ms. */
  duration: number;
}

const ARRIVE = 0.55; // s until impact
const LEAVE = 0.6; // s for the exit zoom
const ICON_SPRITE = 256;
const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

const iconCache = new Map<string, HTMLCanvasElement>();
function iconSprite(icon: string): HTMLCanvasElement {
  let c = iconCache.get(icon);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = ICON_SPRITE;
    const ctx = c.getContext('2d')!;
    ctx.font = `${ICON_SPRITE * 0.78}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, ICON_SPRITE / 2, ICON_SPRITE / 2 + ICON_SPRITE * 0.05);
    iconCache.set(icon, c);
  }
  return c;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

interface Active {
  cfg: HeroConfig;
  age: number;
  impacted: boolean;
}

export class HeroEffect implements OverlayEffect {
  readonly id = 'hero';
  private active: Active[] = [];
  private width = 0;
  private height = 0;
  /** Called once per play at the moment of impact (used for screen shake). */
  onImpact?: () => void;

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  count(): number {
    return this.active.length;
  }

  play(cfg: HeroConfig): void {
    // One hero at a time looks best; a new one replaces the current.
    this.active = [{ cfg, age: 0, impacted: false }];
  }

  update(dt: number): void {
    for (const a of this.active) {
      a.age += dt;
      if (!a.impacted && a.age >= ARRIVE) {
        a.impacted = true;
        this.onImpact?.();
      }
    }
    this.active = this.active.filter((a) => a.age < a.cfg.duration / 1000);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const unit = Math.min(this.width, this.height);
    for (const a of this.active) {
      const total = a.cfg.duration / 1000;
      const t = a.age;
      const cx = this.width / 2;
      const cy = this.height * 0.45;
      const accent = a.cfg.colors[0] ?? '#ffd166';
      const leaving = Math.max(0, (t - (total - LEAVE)) / LEAVE); // 0 → 1 during exit
      const fade = 1 - leaving;

      // Light rays, rotating slowly behind the icon.
      const raysIn = Math.min(t / ARRIVE, 1);
      const rayLen = unit * 0.75;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.35);
      ctx.globalAlpha = 0.5 * raysIn * fade;
      const rayGrad = ctx.createRadialGradient(0, 0, unit * 0.05, 0, 0, rayLen);
      rayGrad.addColorStop(0, accent);
      rayGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rayGrad;
      const rays = 12;
      for (let i = 0; i < rays; i++) {
        const a0 = (i / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rayLen, a0, a0 + (Math.PI * 2) / rays / 2.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Soft glow disc.
      ctx.save();
      ctx.globalAlpha = 0.65 * raysIn * fade;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.32);
      glow.addColorStop(0, accent);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - unit * 0.32, cy - unit * 0.32, unit * 0.64, unit * 0.64);
      ctx.restore();

      // Shockwave rings right after impact.
      if (t >= ARRIVE) {
        for (let r = 0; r < 2; r++) {
          const wt = (t - ARRIVE - r * 0.12) / 0.8;
          if (wt <= 0 || wt >= 1) continue;
          ctx.save();
          ctx.globalAlpha = (1 - wt) * 0.8;
          ctx.strokeStyle = r === 0 ? '#ffffff' : a.cfg.colors[1] ?? accent;
          ctx.lineWidth = unit * 0.02 * (1 - wt) + 1;
          ctx.beginPath();
          ctx.arc(cx, cy, unit * (0.08 + wt * 0.55), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // The icon: flies up from below, overshoots, pulses, zooms out.
      const arrive = Math.min(t / ARRIVE, 1);
      const y = cy + (1 - easeOutBack(arrive)) * this.height * 0.45;
      const pulse = t > ARRIVE ? 1 + Math.sin((t - ARRIVE) * 6) * 0.035 : 1;
      const scale = easeOutBack(arrive) * pulse * (1 + leaving * 0.6);
      const size = unit * 0.34 * Math.max(scale, 0);
      ctx.save();
      ctx.globalAlpha = Math.min(1, arrive * 2) * fade;
      ctx.translate(cx, y);
      ctx.rotate((1 - arrive) * -0.5);
      ctx.drawImage(iconSprite(a.cfg.icon), -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  dispose(): void {
    this.active = [];
  }
}
