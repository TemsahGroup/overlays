import type { EffectPlay } from './registry';

const MAX_QUEUE = 25;

/**
 * Orders effect plays so alerts don't pile on top of each other:
 * 'queue' plays run one after another, 'instant' plays (likes) start at once.
 */
export class EffectScheduler {
  private queue: EffectPlay[] = [];
  private busyUntil = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private run: (play: EffectPlay) => void) {}

  push(play: EffectPlay): void {
    if (play.mode === 'instant') {
      this.run(play);
      return;
    }
    if (this.queue.length >= MAX_QUEUE) this.queue.shift();
    this.queue.push(play);
    this.pump();
  }

  get pending(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.busyUntil = 0;
  }

  private pump(): void {
    if (this.timer) return;
    const wait = this.busyUntil - performance.now();
    if (wait > 0) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pump();
      }, wait);
      return;
    }
    const next = this.queue.shift();
    if (!next) return;
    this.run(next);
    // A small overlap keeps a busy stream lively without stacking cards.
    this.busyUntil = performance.now() + next.duration * 0.8;
    if (this.queue.length) this.pump();
  }
}
