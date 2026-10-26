import { useEffect, useRef } from 'react';
import { getSprite, SPRITE_SCALE } from '../../effects/particles/sprites';
import type { ShapeKind } from '../../effects/types';

interface Props {
  shapes: ShapeKind[];
  colors: string[];
  width?: number;
  height?: number;
}

// Fixed pseudo-random layout so thumbnails are stable between renders.
const SPOTS = [
  [0.15, 0.3, 1], [0.38, 0.62, 1.25], [0.62, 0.28, 0.9], [0.84, 0.6, 1.1],
  [0.28, 0.82, 0.7], [0.72, 0.85, 0.75], [0.5, 0.15, 0.6], [0.92, 0.22, 0.6],
  [0.06, 0.7, 0.65], [0.52, 0.45, 0.8],
];

/** Static gallery preview drawn once with the real particle sprites. */
export function EffectThumb({ shapes, colors, width = 132, height = 74 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    SPOTS.forEach(([x, y, scale], i) => {
      const sprite = getSprite(shapes[i % shapes.length], colors[i % colors.length] ?? '#ffffff');
      const s = 22 * scale * SPRITE_SCALE;
      ctx.save();
      ctx.translate(x * width, y * height);
      ctx.rotate(((i * 37) % 60 - 30) * (Math.PI / 180));
      ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
      ctx.restore();
    });
  }, [shapes, colors, width, height]);

  return <canvas ref={ref} className="effect-thumb" style={{ width, height }} aria-hidden="true" />;
}
