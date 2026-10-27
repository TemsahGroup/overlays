import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_QUEUE, pickSegment, spinTarget } from '../spin';
import type { WheelResult } from './WheelView';

/** How long a result stays on screen before the next queued spin starts. */
const RESULT_MS = 5000;

/**
 * Spin queue: each enqueued spin picks a random segment, animates to it,
 * shows the result, then starts the next one. Timers survive re-renders and
 * are cleared only on unmount.
 */
export function useWheelSpinner(count: number, spinSeconds: number) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [showing, setShowing] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [queue, setQueue] = useState<(string | null)[]>([]);
  const rotationRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (spinning || showing || queue.length === 0 || count < 2) return;
    const [user, ...rest] = queue;
    const index = pickSegment(count);
    const target = spinTarget(rotationRef.current, index, count);
    rotationRef.current = target;
    setQueue(rest);
    setResult(null);
    setRotation(target);
    setSpinning(true);
    timers.current.push(
      setTimeout(() => {
        setSpinning(false);
        setShowing(true);
        setResult({ id: Date.now(), index, user });
        timers.current.push(setTimeout(() => setShowing(false), RESULT_MS));
      }, spinSeconds * 1000 + 150),
    );
  }, [queue, spinning, showing, count, spinSeconds]);

  const enqueue = useCallback((user: string | null, times = 1) => {
    setQueue((q) => [...q, ...Array.from({ length: times }, () => user)].slice(0, MAX_QUEUE));
  }, []);

  const clear = useCallback(() => setQueue([]), []);

  return { rotation, spinning, result, queued: queue.length, busy: spinning || showing || queue.length > 0, enqueue, clear };
}
