import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import type { SnowSettings } from '../config/settings';
import { OverlayEngine } from '../engine/OverlayEngine';
import type { EngineStats } from '../engine/types';
import { ParticleSystem } from '../effects/particles/ParticleSystem';
import { buildPlay, effectForEvent, type EffectPlay } from '../effects/registry';
import { EffectScheduler } from '../effects/scheduler';
import type { EffectId, EffectSettings } from '../effects/types';
import { SnowEffect } from '../effects/snow/SnowEffect';
import { onOverlayEvent } from '../events/eventBus';
import type { OverlayEvent } from '../events/types';
import { AlertLayer, type ActiveAlert } from './AlertLayer';

/** Imperative handle for previews that should not go through the event bus. */
export interface StageApi {
  play(play: EffectPlay): void;
}

interface Props {
  effects: EffectId[];
  settings: Record<EffectId, EffectSettings>;
  snow: boolean;
  snowSettings: SnowSettings;
  testBadge: boolean;
  onStats?: (stats: EngineStats) => void;
  /**
   * Optional custom event → play mapping (used by the Gift Overlay Builder).
   * When omitted, the LIVE Overlay Effects registry decides, as before.
   */
  resolvePlay?: (event: OverlayEvent) => EffectPlay | null;
  /** Receives a handle to play effects directly (builder preview). */
  apiRef?: MutableRefObject<StageApi | null>;
}

/**
 * The overlay itself: one transparent canvas (particles + optional snow) and
 * a DOM layer for alert cards. Used full-screen in overlay mode and inside
 * the preview frame on the dashboard.
 */
export function OverlayStage({ effects, settings, snow, snowSettings, testBadge, onStats, resolvePlay, apiRef }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<OverlayEngine | null>(null);
  const snowRef = useRef<SnowEffect | null>(null);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [unit, setUnit] = useState(10);

  // Latest props for long-lived callbacks, without re-subscribing.
  const live = useRef({ effects, settings, onStats, resolvePlay });
  live.current = { effects, settings, onStats, resolvePlay };

  // Engine + particle system + scheduler live for the whole component lifetime.
  useEffect(() => {
    const engine = new OverlayEngine(canvasRef.current!);
    const particles = new ParticleSystem();
    engine.add(particles);
    engine.onStats = (s) => live.current.onStats?.(s);
    engine.start();
    engineRef.current = engine;

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const run = (play: EffectPlay) => {
      play.bursts.forEach((b) => particles.play(b));
      if (!play.message) return;
      const key = play.event.id + play.effectId;
      // Likes arrive in rapid streams: keep only the newest like card.
      setAlerts((list) => [...list.filter((a) => play.effectId !== 'like' || a.play.effectId !== 'like'), { key, play }]);
      const t = setTimeout(() => {
        timers.delete(t);
        setAlerts((list) => list.filter((a) => a.key !== key));
      }, play.duration);
      timers.add(t);
    };
    const scheduler = new EffectScheduler(run);
    if (apiRef) apiRef.current = { play: (p) => scheduler.push(p) };

    const unsubscribe = onOverlayEvent((event) => {
      const { effects: active, settings: current, resolvePlay: resolve } = live.current;
      if (resolve) {
        const play = resolve(event);
        if (play) scheduler.push(play);
        return;
      }
      const id = effectForEvent(event, current);
      if (id && active.includes(id)) scheduler.push(buildPlay(id, current[id], event));
    });

    return () => {
      unsubscribe();
      if (apiRef) apiRef.current = null;
      scheduler.clear();
      timers.forEach(clearTimeout);
      engine.dispose();
      engineRef.current = null;
      snowRef.current = null;
    };
  }, []);

  // Optional ambient snow layer, added/removed without touching other effects.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !snow) return;
    const effect = new SnowEffect(snowSettings);
    engine.add(effect, true);
    snowRef.current = effect;
    return () => {
      engine.remove(effect.id);
      snowRef.current = null;
    };
    // snowSettings changes are pushed into the running effect below instead.
  }, [snow]);

  useEffect(() => {
    snowRef.current?.setSettings(snowSettings);
  }, [snowSettings]);

  // Alert sizes scale with the stage, so a 1920×1080 source and a small
  // preview look the same. (Container query units are avoided on purpose:
  // older OBS browser builds do not support them.)
  useEffect(() => {
    const el = rootRef.current!;
    const ro = new ResizeObserver(() => setUnit(Math.min(el.clientWidth, el.clientHeight) / 100));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="stage" style={{ '--u': `${unit}px` } as CSSProperties}>
      <canvas ref={canvasRef} className="stage-canvas" aria-hidden="true" />
      <AlertLayer alerts={alerts} testBadge={testBadge} />
    </div>
  );
}
