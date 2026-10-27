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

const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

function drawEmoji(ctx: CanvasRenderingContext2D, char: string, glow: string) {
  // Emoji renders natively in Chrome/OBS (CEF) on Windows and macOS.
  ctx.font = `${BOX}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.fillText(char, SPRITE / 2, SPRITE / 2 + 6);
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeKind, color: string, emoji = '✨') {
  const glow = (blur: number) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  };

  switch (shape) {
    case 'rose':
      drawEmoji(ctx, '🌹', 'rgba(255, 40, 90, 0.55)');
      return;
    case 'emoji':
      drawEmoji(ctx, emoji, 'rgba(255, 255, 255, 0.35)');
      return;
    case 'lantern':
      // Ramadan fanous: gold frame, coloured glass, warm inner light.
      withBox(ctx, () => {
        const gold = (y0: number, y1: number) => {
          const g = ctx.createLinearGradient(0, y0, 0, y1);
          g.addColorStop(0, '#ffe08a');
          g.addColorStop(0.5, '#d99a1e');
          g.addColorStop(1, '#8a5a0a');
          return g;
        };
        ctx.shadowColor = 'rgba(255, 190, 60, 0.8)';
        ctx.shadowBlur = 18;
        // hanging ring
        ctx.strokeStyle = '#e8b64a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(50, 7, 5, 0, Math.PI * 2);
        ctx.stroke();
        // dome
        ctx.fillStyle = gold(10, 30);
        ctx.beginPath();
        ctx.moveTo(50, 11);
        ctx.quadraticCurveTo(74, 22, 72, 30);
        ctx.lineTo(28, 30);
        ctx.quadraticCurveTo(26, 22, 50, 11);
        ctx.fill();
        // glass body with light
        const glass = ctx.createRadialGradient(50, 55, 2, 50, 55, 26);
        glass.addColorStop(0, '#fff6c8');
        glass.addColorStop(0.35, shade(color, 0.35));
        glass.addColorStop(1, shade(color, -0.25));
        ctx.fillStyle = glass;
        ctx.beginPath();
        ctx.moveTo(30, 30);
        ctx.lineTo(70, 30);
        ctx.lineTo(76, 58);
        ctx.lineTo(66, 80);
        ctx.lineTo(34, 80);
        ctx.lineTo(24, 58);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // frame bars
        ctx.strokeStyle = '#c98a14';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(50, 30);
        ctx.lineTo(50, 80);
        ctx.moveTo(24, 58);
        ctx.lineTo(76, 58);
        ctx.stroke();
        // base
        ctx.fillStyle = gold(80, 94);
        ctx.beginPath();
        ctx.moveTo(32, 80);
        ctx.lineTo(68, 80);
        ctx.lineTo(60, 92);
        ctx.lineTo(40, 92);
        ctx.closePath();
        ctx.fill();
      });
      return;
    case 'crescent':
      withBox(ctx, () => {
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        const g = ctx.createLinearGradient(10, 10, 80, 90);
        g.addColorStop(0, shade(color, 0.5));
        g.addColorStop(1, color);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(46, 50, 40, 0, Math.PI * 2);
        ctx.fill();
        // cut the inner circle out to leave the crescent
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(62, 42, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = shade(color, 0.6);
        ctx.translate(26, -2);
        starPath(ctx, 5, 9, 4);
        ctx.fill();
      });
      return;
    case 'coin':
      withBox(ctx, () => {
        ctx.shadowColor = 'rgba(255, 200, 60, 0.7)';
        ctx.shadowBlur = 12;
        const rim = ctx.createLinearGradient(10, 10, 90, 90);
        rim.addColorStop(0, '#fff1a8');
        rim.addColorStop(0.5, shade(color, 0));
        rim.addColorStop(1, shade(color, -0.45));
        ctx.fillStyle = rim;
        ctx.beginPath();
        ctx.arc(50, 50, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        const face = ctx.createLinearGradient(80, 15, 20, 85);
        face.addColorStop(0, shade(color, 0.45));
        face.addColorStop(1, shade(color, -0.2));
        ctx.fillStyle = face;
        ctx.beginPath();
        ctx.arc(50, 50, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(color, -0.35);
        starPath(ctx, 5, 18, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(36, 30, 12, 5, -0.7, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    case 'gem':
      // Brilliant-cut diamond with shaded facets.
      withBox(ctx, () => {
        glow(16);
        const facet = (pts: number[], amount: number) => {
          ctx.fillStyle = shade(color, amount);
          ctx.beginPath();
          ctx.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
          ctx.closePath();
          ctx.fill();
        };
        facet([20, 30, 80, 30, 50, 92], -0.1); // pavilion
        ctx.shadowBlur = 0;
        facet([20, 30, 50, 30, 50, 92], -0.35);
        facet([50, 30, 66, 30, 50, 92], 0.15);
        facet([32, 12, 68, 12, 80, 30, 20, 30], 0.35); // crown
        facet([32, 12, 50, 12, 42, 30, 20, 30], 0.6);
        facet([50, 12, 68, 12, 80, 30, 58, 30], 0.1);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.translate(-14, -30);
        starPath(ctx, 4, 9, 2);
        ctx.fill();
      });
      return;
    case 'balloon':
      withBox(ctx, () => {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(50, 76);
        ctx.bezierCurveTo(44, 84, 56, 90, 48, 99);
        ctx.stroke();
        glow(10);
        const g = ctx.createRadialGradient(38, 26, 4, 50, 40, 40);
        g.addColorStop(0, shade(color, 0.55));
        g.addColorStop(0.5, color);
        g.addColorStop(1, shade(color, -0.35));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(50, 40, 30, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(45, 77);
        ctx.lineTo(55, 77);
        ctx.lineTo(50, 71);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(38, 24, 7, 11, -0.5, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
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

export function getSprite(shape: ShapeKind, color: string, emoji?: string): HTMLCanvasElement {
  const key = shape === 'rose' ? 'rose' : shape === 'emoji' ? `emoji|${emoji}` : `${shape}|${color}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = SPRITE;
    drawShape(sprite.getContext('2d')!, shape, color, emoji);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Sprites include glow padding; draw them this much larger than the particle size. */
export const SPRITE_SCALE = SPRITE / BOX;
