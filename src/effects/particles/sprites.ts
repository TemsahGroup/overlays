// Every particle shape is drawn once into a small offscreen canvas and then
// stamped with drawImage. Gradients, glows and emoji are expensive to draw;
// copying a bitmap is not.

import type { ShapeKind } from '../types';

const SPRITE = 128; // sprite canvas size
const BOX = 96; // shape drawn inside this box, leaving room for glow
const PAD = (SPRITE - BOX) / 2;

const cache = new Map<string, HTMLCanvasElement>();

function shade(hex: string, amount: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    const t = amount < 0 ? 0 : 255;
    return Math.round(v + (t - v) * Math.abs(amount));
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function withBox(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.translate(PAD, PAD);
  ctx.scale(BOX / 100, BOX / 100);
  draw();
  ctx.restore();
}

function heartPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(50, 90);
  ctx.bezierCurveTo(20, 68, 4, 48, 4, 30);
  ctx.bezierCurveTo(4, 13, 17, 4, 30, 4);
  ctx.bezierCurveTo(40, 4, 47, 10, 50, 19);
  ctx.bezierCurveTo(53, 10, 60, 4, 70, 4);
  ctx.bezierCurveTo(83, 4, 96, 13, 96, 30);
  ctx.bezierCurveTo(96, 48, 80, 68, 50, 90);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    ctx.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeKind, color: string) {
  const glow = (blur: number) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  };

  switch (shape) {
    case 'rose': {
      // Emoji renders natively in Chrome/OBS (CEF) on Windows and macOS.
      ctx.font = `${BOX}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 40, 90, 0.55)';
      ctx.shadowBlur = 14;
      ctx.fillText('🌹', SPRITE / 2, SPRITE / 2 + 6);
      return;
    }
    case 'heart':
      withBox(ctx, () => {
        glow(12);
        const g = ctx.createLinearGradient(20, 0, 80, 95);
        g.addColorStop(0, shade(color, 0.35));
        g.addColorStop(0.55, color);
        g.addColorStop(1, shade(color, -0.35));
        ctx.fillStyle = g;
        heartPath(ctx);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(28, 26, 11, 7, -0.6, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    case 'petal':
      withBox(ctx, () => {
        const g = ctx.createLinearGradient(50, 5, 50, 95);
        g.addColorStop(0, shade(color, 0.3));
        g.addColorStop(1, shade(color, -0.4));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(50, 95);
        ctx.bezierCurveTo(10, 70, 12, 20, 40, 6);
        ctx.quadraticCurveTo(50, 14, 60, 6);
        ctx.bezierCurveTo(88, 20, 90, 70, 50, 95);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 88);
        ctx.quadraticCurveTo(46, 50, 50, 16);
        ctx.stroke();
      });
      return;
    case 'circle': {
      const c = SPRITE / 2;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, shade(color, 0.4));
      g.addColorStop(0.5, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SPRITE, SPRITE);
      return;
    }
    case 'star':
      withBox(ctx, () => {
        glow(14);
        const g = ctx.createRadialGradient(50, 45, 4, 50, 50, 50);
        g.addColorStop(0, shade(color, 0.6));
        g.addColorStop(1, color);
        ctx.fillStyle = g;
        starPath(ctx, 5, 48, 21);
        ctx.fill();
      });
      return;
    case 'sparkle':
      withBox(ctx, () => {
        glow(18);
        ctx.fillStyle = shade(color, 0.55);
        starPath(ctx, 4, 50, 9);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(50, 50, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    case 'confetti':
      withBox(ctx, () => {
        ctx.fillStyle = color;
        ctx.beginPath();
        // roundRect is missing in older embedded browsers (some OBS builds).
        if (ctx.roundRect) ctx.roundRect(15, 32, 70, 36, 6);
        else ctx.rect(15, 32, 70, 36);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(15, 32, 70, 10);
      });
      return;
  }
}

export function getSprite(shape: ShapeKind, color: string): HTMLCanvasElement {
  const key = shape === 'rose' ? 'rose' : `${shape}|${color}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = SPRITE;
    drawShape(sprite.getContext('2d')!, shape, color);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Sprites include glow padding; draw them this much larger than the particle size. */
export const SPRITE_SCALE = SPRITE / BOX;
