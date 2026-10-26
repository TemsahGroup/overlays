// Pre-rendered flake sprites. Drawing a cached bitmap with drawImage is much
// cheaper than building a gradient or path for every flake on every frame.

export const SPRITE_RADIUS = 32;

function makeSprite(stops: [number, string][]): HTMLCanvasElement {
  const size = SPRITE_RADIUS * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(SPRITE_RADIUS, SPRITE_RADIUS, 0, SPRITE_RADIUS, SPRITE_RADIUS, SPRITE_RADIUS);
  stops.forEach(([offset, color]) => g.addColorStop(offset, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * Crisp flake for small/distant snow. The faint cool-grey rim keeps flakes
 * readable on bright stream backgrounds without adding any background.
 */
export function createCrispSprite(): HTMLCanvasElement {
  return makeSprite([
    [0, 'rgba(255,255,255,1)'],
    [0.42, 'rgba(255,255,255,0.95)'],
    [0.62, 'rgba(228,236,248,0.7)'],
    [0.8, 'rgba(160,180,210,0.28)'],
    [1, 'rgba(160,180,210,0)'],
  ]);
}

/** Soft, out-of-focus flake for large foreground snow (bokeh look). */
export function createSoftSprite(): HTMLCanvasElement {
  return makeSprite([
    [0, 'rgba(255,255,255,0.85)'],
    [0.3, 'rgba(255,255,255,0.6)'],
    [0.65, 'rgba(225,235,250,0.25)'],
    [1, 'rgba(200,215,240,0)'],
  ]);
}
