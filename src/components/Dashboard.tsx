import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { DEFAULT_SNOW, type SnowSettings } from '../config/settings';
import type { EngineStats } from '../engine/types';
import { cloneDefaults, EFFECT_LABELS, settingsToParams } from '../effects/settings';
import { EFFECT_IDS, type EffectId, type EffectSettings } from '../effects/types';
import { createMockAdapter, mock } from '../events/adapters/mockAdapter';
import { onOverlayEvent } from '../events/eventBus';
import type { OverlayEvent } from '../events/types';
import { EventLog } from './EventLog';
import { OverlayStage } from './OverlayStage';
import { SettingsEditor } from './SettingsEditor';

const STORAGE_KEY = 'tiktok-overlay-settings-v1';
type Aspect = '16:9' | '9:16';

function loadSettings(initial: Record<EffectId, EffectSettings>, fromUrl: boolean) {
  if (fromUrl) return initial;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...cloneDefaults(), ...saved } as Record<EffectId, EffectSettings>;
  } catch {
    /* storage unavailable or corrupt — fall back to defaults */
  }
  return initial;
}

const ICONS: Record<EffectId, string> = { gift: '🌹', follow: '💖', like: '👍', custom: '✨' };

interface Props {
  initialSettings: Record<EffectId, EffectSettings>;
  settingsFromUrl: boolean;
  initialSnow: boolean;
  snowSettings: SnowSettings;
  initialDemo: boolean;
}

export function Dashboard({ initialSettings, settingsFromUrl, initialSnow, snowSettings, initialDemo }: Props) {
  const [settings, setSettings] = useState(() => loadSettings(initialSettings, settingsFromUrl));
  const [tab, setTab] = useState<EffectId>('gift');
  const [username, setUsername] = useState('test_viewer');
  const [repeat, setRepeat] = useState(1);
  const [likes, setLikes] = useState(15);
  const [customName, setCustomName] = useState('share');
  const [demo, setDemo] = useState(initialDemo);
  const [snow, setSnow] = useState(initialSnow);
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [log, setLog] = useState<OverlayEvent[]>([]);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore: preview still works without persistence */
    }
  }, [settings]);

  useEffect(() => onOverlayEvent((e) => setLog((l) => [e, ...l].slice(0, 30))), []);

  useEffect(() => {
    if (!demo) return;
    const adapter = createMockAdapter();
    adapter.connect();
    return () => adapter.disconnect();
  }, [demo]);

  const base = `${window.location.origin}${window.location.pathname}`;
  const urls = useMemo(() => {
    const single = (id: EffectId) => {
      const p = new URLSearchParams({ overlay: '1', effect: id });
      settingsToParams(id, settings[id], false).forEach((v, k) => p.set(k, v));
      return `${base}?${p}`;
    };
    const all = new URLSearchParams({ overlay: '1', effect: 'all' });
    EFFECT_IDS.forEach((id) => settingsToParams(id, settings[id], true).forEach((v, k) => all.set(k, v)));
    if (snow) all.set('snow', '1');
    return { single, all: `${base}?${all}` };
  }, [settings, snow, base]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      window.prompt('Copy this URL:', text);
    }
  };

  const fire = (id: EffectId) => {
    if (id === 'gift') mock.gift(username, settings.gift.filter === '*' ? 'Rose' : settings.gift.filter, repeat);
    if (id === 'follow') mock.follow(username);
    if (id === 'like') mock.like(username, likes);
    if (id === 'custom') mock.custom(username, customName || 'custom');
  };

  const update = (id: EffectId, next: EffectSettings) => setSettings((s) => ({ ...s, [id]: next }));

  return (
    <div className="dashboard">
      <aside className="panel">
        <header className="panel-header">
          <div>
            <h1>LIVE Overlay Effects</h1>
            <p className="sub">Local preview · all events here are simulated</p>
            <p className="sub">
              <a href="#/builder">🎁 Gift Overlay Builder →</a>
            </p>
          </div>
          <span className="chip chip--mock">MOCK</span>
        </header>

        <section className="section">
          <h2>Simulate events</h2>
          <label className="field">
            <span>Viewer username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={40} />
          </label>
          <div className="sim-grid">
            <div className="sim-card" style={{ '--accent': settings.gift.colors[0] } as CSSProperties}>
              <button className="sim-btn" onClick={() => fire('gift')}>
                <span className="sim-emoji">🌹</span>
                <span>Rose gift</span>
              </button>
              <label className="mini">
                ×
                <input type="number" min={1} max={99} value={repeat} onChange={(e) => setRepeat(Math.max(1, Number(e.target.value) || 1))} />
              </label>
            </div>
            <div className="sim-card" style={{ '--accent': settings.follow.colors[0] } as CSSProperties}>
              <button className="sim-btn" onClick={() => fire('follow')}>
                <span className="sim-emoji">💖</span>
                <span>Follow</span>
              </button>
            </div>
            <div className="sim-card" style={{ '--accent': settings.like.colors[1] ?? settings.like.colors[0] } as CSSProperties}>
              <button className="sim-btn" onClick={() => fire('like')}>
                <span className="sim-emoji">👍</span>
                <span>Likes</span>
              </button>
              <label className="mini">
                n
                <input type="number" min={1} max={999} value={likes} onChange={(e) => setLikes(Math.max(1, Number(e.target.value) || 1))} />
              </label>
            </div>
            <div className="sim-card" style={{ '--accent': settings.custom.colors[0] } as CSSProperties}>
              <button className="sim-btn" onClick={() => fire('custom')}>
                <span className="sim-emoji">✨</span>
                <span>Custom</span>
              </button>
              <input className="mini-text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="event name" aria-label="Custom event name" />
            </div>
          </div>
          <div className="toggles">
            <label className="switch">
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
              <span>Auto demo (random mock events)</span>
            </label>
            <label className="switch">
              <input type="checkbox" checked={snow} onChange={(e) => setSnow(e.target.checked)} />
              <span>Ambient snow layer</span>
            </label>
          </div>
        </section>

        <section className="section">
          <h2>Effect settings</h2>
          <div className="tabs" role="tablist">
            {EFFECT_IDS.map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>
                {ICONS[id]} {EFFECT_LABELS[id].split(' ')[0]}
              </button>
            ))}
          </div>
          <SettingsEditor id={tab} value={settings[tab]} onChange={(v) => update(tab, v)} onPreview={() => fire(tab)} />
        </section>

        <section className="section">
          <h2>Overlay URLs</h2>
          <UrlRow label={`${EFFECT_LABELS[tab]} only`} url={urls.single(tab)} copied={copied === 'single'} onCopy={() => copy(urls.single(tab), 'single')} />
          <UrlRow label="All effects in one source" url={urls.all} copied={copied === 'all'} onCopy={() => copy(urls.all, 'all')} />
        </section>

        <section className="section">
          <h2>Event log</h2>
          <EventLog events={log} />
        </section>
      </aside>

      <main className="preview">
        <div className="preview-bar">
          <span className="hint">Transparent overlay preview</span>
          <div className="seg">
            {(['16:9', '9:16'] as Aspect[]).map((a) => (
              <button key={a} className={aspect === a ? 'is-active' : ''} onClick={() => setAspect(a)}>
                {a === '16:9' ? '1920×1080' : '1080×1920'}
              </button>
            ))}
          </div>
          <span className="hint stats">{stats ? `${stats.fps} fps · ${stats.particles} particles` : ''}</span>
        </div>
        <div className="preview-area">
          <div className={`preview-frame preview-frame--${aspect === '16:9' ? 'wide' : 'tall'}`}>
            <OverlayStage effects={EFFECT_IDS} settings={settings} snow={snow} snowSettings={snow ? snowSettings : DEFAULT_SNOW} testBadge onStats={setStats} />
          </div>
        </div>
      </main>
    </div>
  );
}

function UrlRow({ label, url, copied, onCopy }: { label: string; url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="url-row">
      <span className="hint">{label}</span>
      <code>{url}</code>
      <div className="row">
        <button className="btn" onClick={onCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <a className="btn" href={url} target="_blank" rel="noreferrer">
          Open ↗
        </a>
      </div>
    </div>
  );
}
