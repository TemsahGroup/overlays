import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { OverlayStage, type StageApi } from '../../components/OverlayStage';
import { DEFAULT_SNOW } from '../../config/settings';
import { DEFAULT_SETTINGS } from '../../effects/settings';
import { makeEventId } from '../../events/eventBus';
import type { GiftEvent } from '../../events/types';
import { BUILDER_EFFECTS, getBuilderEffect } from '../effects';
import { giftIcon, searchGifts } from '../gifts';
import { sendTestGift } from '../giftEvents';
import { buildMappingPlay, resolveConfigPlay } from '../play';
import { encodePortable } from '../repository/portable';
import { repository } from '../repository/localRepository';
import { OwnershipError } from '../repository/types';
import { overlayUrl } from '../route';
import { SCHEMA_VERSION, type BuilderEffectId, type GiftMapping, type Intensity, type OverlayConfig } from '../types';
import { defaultMapping, LIMITS, newId, sanitizeEffectSettings, toPublic } from '../validate';
import { EffectThumb } from './EffectThumb';
import { SetupGuide } from './SetupGuide';

function newConfig(): OverlayConfig {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    ownerId: repository.currentOwnerId(),
    name: 'My gift overlay',
    layout: '16:9',
    mappings: [defaultMapping()],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

const sameContent = (a: OverlayConfig | null, b: OverlayConfig) =>
  !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });

type Status = { kind: 'info' | 'error' | 'ok'; text: string } | null;

export function BuilderPage({ id }: { id: string | null }) {
  const [draft, setDraft] = useState<OverlayConfig>(newConfig);
  const [saved, setSaved] = useState<OverlayConfig | null>(null);
  const [mine, setMine] = useState<OverlayConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const stageApi = useRef<StageApi | null>(null);

  const refreshList = useCallback(() => repository.listMine().then(setMine), []);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Gift Overlay Builder';
    return () => {
      document.title = previous;
    };
  }, []);

  // Load the configuration named in the route (or start a fresh one).
  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        const fresh = newConfig();
        if (!cancelled) {
          setDraft(fresh);
          setSaved(null);
        }
        return;
      }
      const found = await repository.get(id);
      if (cancelled) return;
      if (!found) {
        setStatus({ kind: 'error', text: 'Configuration not found in this browser’s storage.' });
        setDraft(newConfig());
        setSaved(null);
        return;
      }
      setDraft(found);
      setSaved(found);
      if (found.ownerId !== repository.currentOwnerId()) {
        setReadOnly(true);
        setStatus({ kind: 'info', text: 'This configuration belongs to another owner. Duplicate it to make your own copy.' });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
  }, [id, refreshList]);

  const mapping = draft.mappings[0];
  const effect = getBuilderEffect(mapping.effectId);
  const dirty = !sameContent(saved, draft);

  const updateMapping = (patch: Partial<GiftMapping>) =>
    setDraft((d) => ({ ...d, mappings: [{ ...d.mappings[0], ...patch }, ...d.mappings.slice(1)] }));
  const updateSettings = (patch: Partial<GiftMapping['effectSettings']>) =>
    updateMapping({ effectSettings: { ...mapping.effectSettings, ...patch } });
  const updateAlert = (patch: Partial<GiftMapping['alertSettings']>) =>
    updateMapping({ alertSettings: { ...mapping.alertSettings, ...patch } });

  const chooseEffect = (effectId: BuilderEffectId) =>
    updateMapping({ effectId, effectSettings: { ...sanitizeEffectSettings({}, effectId), intensity: mapping.effectSettings.intensity } });

  // The preview stage follows the unsaved draft so Test reflects current edits.
  const resolvePlay = useMemo(() => resolveConfigPlay({ ...toPublic(draft), enabled: true }), [draft]);

  const preview = () => {
    const event: GiftEvent = {
      id: makeEventId(),
      timestamp: Date.now(),
      source: 'mock',
      user: { username: 'preview' },
      type: 'gift',
      giftName: mapping.selectedGiftName,
      repeatCount: 1,
    };
    stageApi.current?.play(buildMappingPlay(mapping, event));
  };

  const test = () => sendTestGift(mapping.selectedGiftName, 'test_viewer', 1, mapping.selectedGiftId ?? undefined);

  const save = async () => {
    try {
      const record = await repository.save(draft);
      setDraft(record);
      setSaved(record);
      setStatus({ kind: 'ok', text: 'Saved.' });
      refreshList();
      if (id !== record.id) window.location.hash = `#/builder/${record.id}`;
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof OwnershipError ? e.message : 'Could not save (storage unavailable?).' });
    }
  };

  const duplicate = () => {
    const now = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: repository.currentOwnerId(), name: `${draft.name} (copy)`, createdAt: now, updatedAt: now, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setStatus({ kind: 'info', text: 'Copy created. Save it to keep it.' });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await repository.setEnabled(saved.id, !saved.enabled);
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(`Delete “${saved.name}”? Its overlay links will stop working in this browser.`)) return;
    await repository.remove(saved.id);
    window.location.hash = '#/builder';
    refreshList();
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      window.prompt('Copy this URL:', text);
    }
  };

  const portableUrl = saved ? overlayUrl(saved.id, encodePortable(toPublic(saved))) : null;
  const localUrl = saved ? overlayUrl(saved.id) : null;
  const gifts = searchGifts(query);
  const customGift = query.trim() && !gifts.some((g) => g.name.toLowerCase() === query.trim().toLowerCase()) ? query.trim() : null;
  const s = mapping.effectSettings;

  return (
    <div className="dashboard builder">
      <aside className="panel">
        <header className="panel-header">
          <div>
            <h1>Gift Overlay Builder</h1>
            <p className="sub">
              Pick a gift, pick an effect, get an OBS link · <a href="./">LIVE Overlay Effects ↗</a>
            </p>
          </div>
          <span className="chip chip--mock" title={repository.capabilities.label}>LOCAL</span>
        </header>

        {status && <p className={`notice notice--${status.kind}`}>{status.text}</p>}

        <fieldset className="section" disabled={readOnly}>
          <h2>1 · Overlay</h2>
          <div className="field-pair field-pair--wide">
            <label className="field">
              <span>Name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} />
            </label>
            <div className="field">
              <span>Layout</span>
              <div className="seg seg--inline">
                {(['16:9', '9:16'] as const).map((l) => (
                  <button key={l} type="button" className={draft.layout === l ? 'is-active' : ''} onClick={() => setDraft({ ...draft, layout: l })}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="section" disabled={readOnly}>
          <h2>2 · Gift</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search gifts or type any gift name…" aria-label="Search gifts" />
          <div className="gift-grid" role="listbox" aria-label="Gifts">
            {gifts.map((g) => (
              <button
                key={g.name}
                type="button"
                role="option"
                aria-selected={mapping.selectedGiftName === g.name}
                className={`gift ${mapping.selectedGiftName === g.name ? 'is-active' : ''}`}
                onClick={() => updateMapping({ selectedGiftName: g.name, selectedGiftId: null })}
              >
                <span className="gift-icon">{g.icon}</span>
                <span>{g.name}</span>
              </button>
            ))}
            {customGift && (
              <button type="button" className="gift gift--custom" onClick={() => updateMapping({ selectedGiftName: customGift, selectedGiftId: null })}>
                <span className="gift-icon">🎁</span>
                <span>Use “{customGift}”</span>
              </button>
            )}
          </div>
          <p className="hint">
            Selected: <b>{giftIcon(mapping.selectedGiftName)} {mapping.selectedGiftName}</b>. Names are matched case-insensitively; check the exact gift name in TikFinity.
          </p>
          <details className="advanced">
            <summary>Advanced: gift ID</summary>
            <label className="field">
              <span>Gift ID (optional — matched instead of the name when both sides provide one)</span>
              <input
                value={mapping.selectedGiftId ?? ''}
                onChange={(e) => updateMapping({ selectedGiftId: e.target.value.replace(/[^\w-]/g, '').slice(0, 32) || null })}
                placeholder="leave empty to match by name"
              />
            </label>
          </details>
        </fieldset>

        <fieldset className="section" disabled={readOnly}>
          <h2>3 · Effect</h2>
          <div className="effect-gallery">
            {BUILDER_EFFECTS.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`effect-card ${mapping.effectId === e.id ? 'is-active' : ''}`}
                onClick={() => chooseEffect(e.id)}
                aria-pressed={mapping.effectId === e.id}
              >
                <EffectThumb shapes={e.thumb} colors={mapping.effectId === e.id ? s.colors : e.defaults.colors} />
                <span className="effect-name">{e.label}</span>
                <span className="hint">{e.description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="section" disabled={readOnly}>
          <h2>4 · Customize</h2>
          {(
            [
              ['count', 'Particle count', ''],
              ['duration', 'Duration', 's'],
              ['size', 'Particle size', 'px'],
            ] as const
          ).map(([key, label, unit]) => (
            <label key={key} className="field">
              <span className="field-row">
                <span>{label}</span>
                <output>
                  {key === 'duration' ? (s[key] / 1000).toFixed(1) : s[key]}
                  {unit}
                </output>
              </span>
              <input type="range" min={LIMITS[key].min} max={LIMITS[key].max} step={key === 'duration' ? 100 : 1} value={s[key]} onChange={(e) => updateSettings({ [key]: Number(e.target.value) })} />
            </label>
          ))}
          <div className="field">
            <span>Intensity</span>
            <div className="seg seg--inline">
              {(['low', 'medium', 'high'] as Intensity[]).map((i) => (
                <button key={i} type="button" className={s.intensity === i ? 'is-active' : ''} onClick={() => updateSettings({ intensity: i })}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Colors</span>
            <div className="colors">
              {s.colors.map((c, i) => (
                <span key={i} className="color">
                  <input type="color" value={c} onChange={(e) => updateSettings({ colors: s.colors.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Color ${i + 1}`} />
                  {s.colors.length > 1 && (
                    <button type="button" className="color-x" onClick={() => updateSettings({ colors: s.colors.filter((_, j) => j !== i) })} aria-label="Remove color">
                      ×
                    </button>
                  )}
                </span>
              ))}
              {s.colors.length < 8 && (
                <button type="button" className="color-add" onClick={() => updateSettings({ colors: [...s.colors, '#ffffff'] })} aria-label="Add color">
                  +
                </button>
              )}
            </div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={mapping.alertSettings.enabled} onChange={(e) => updateAlert({ enabled: e.target.checked })} />
            <span>Show alert text</span>
          </label>
          {mapping.alertSettings.enabled && (
            <div className="field-pair field-pair--icon">
              <label className="field">
                <span>Icon</span>
                <input value={mapping.alertSettings.icon} onChange={(e) => updateAlert({ icon: e.target.value })} maxLength={8} />
              </label>
              <label className="field">
                <span>Text · {'{user} {gift} {count}'}</span>
                <input value={mapping.alertSettings.text} onChange={(e) => updateAlert({ text: e.target.value })} maxLength={120} />
              </label>
            </div>
          )}
          <button type="button" className="btn" onClick={() => chooseEffect(mapping.effectId)}>
            Reset {effect.label} to defaults
          </button>
        </fieldset>

        <section className="section">
          <h2>5 · Preview & test</h2>
          <div className="row">
            <button type="button" className="btn primary" onClick={preview}>
              ▶ Preview
            </button>
            <button type="button" className="btn" onClick={test} title="Sends a TEST gift through the event pipeline">
              🧪 Send test gift
            </button>
          </div>
          <p className="hint">
            Preview plays here only. “Send test gift” goes through the same matching as real gifts and also reaches overlay tabs open in this browser. Both are labelled TEST.
          </p>
        </section>

        <section className="section">
          <h2>6 · Save & overlay URL</h2>
          {readOnly ? (
            <button type="button" className="btn primary" onClick={duplicate}>
              Duplicate as my configuration
            </button>
          ) : (
            <div className="row">
              <button type="button" className="btn primary" onClick={save} disabled={!dirty && !!saved}>
                {saved ? (dirty ? '💾 Save changes' : '✓ Saved') : '💾 Save configuration'}
              </button>
              {saved && (
                <button type="button" className="btn" onClick={toggleEnabled}>
                  {saved.enabled ? 'Disable overlay' : 'Enable overlay'}
                </button>
              )}
            </div>
          )}
          {saved && dirty && <p className="notice notice--info">Unsaved changes — overlay links below still use the last saved version.</p>}
          {saved && !saved.enabled && <p className="notice notice--error">Disabled: overlays loading from storage will not play.</p>}
          {portableUrl && localUrl ? (
            <>
              <div className="url-row">
                <span className="hint">
                  <b>Portable OBS link</b> — carries this config’s public settings, works on any computer that can open this app. Copy again after each save.
                </span>
                <code>{portableUrl}</code>
                <div className="row">
                  <button type="button" className="btn" onClick={() => copy(portableUrl, 'portable')}>
                    {copied === 'portable' ? '✓ Copied' : 'Copy overlay URL'}
                  </button>
                  <a className="btn" href={portableUrl} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </div>
              </div>
              <div className="url-row">
                <span className="hint">
                  <b>Storage link</b> — loads from this browser’s storage; always up to date and can be disabled, but only works in this browser (not in OBS).
                </span>
                <code>{localUrl}</code>
                <div className="row">
                  <button type="button" className="btn" onClick={() => copy(localUrl, 'local')}>
                    {copied === 'local' ? '✓ Copied' : 'Copy'}
                  </button>
                  <a className="btn" href={localUrl} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </div>
              </div>
            </>
          ) : (
            <p className="hint">Save the configuration to get its overlay URL.</p>
          )}
          {saved && !readOnly && (
            <button type="button" className="btn btn--danger" onClick={remove}>
              Delete configuration
            </button>
          )}
        </section>

        <section className="section">
          <h2>My configurations</h2>
          <p className="hint">Stored in {repository.capabilities.label.toLowerCase()}.</p>
          <ul className="config-list">
            {mine.map((c) => (
              <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                <a href={`#/builder/${c.id}`}>
                  <span className="gift-icon">{giftIcon(c.mappings[0].selectedGiftName)}</span>
                  <span className="config-name">{c.name}</span>
                  <span className="hint">
                    {c.mappings[0].selectedGiftName} → {getBuilderEffect(c.mappings[0].effectId).label}
                    {!c.enabled && ' · disabled'}
                  </span>
                </a>
              </li>
            ))}
            {!mine.length && <li className="hint">No saved configurations yet.</li>}
          </ul>
          <a className="btn" href="#/builder" onClick={() => id === null && setDraft(newConfig())}>
            ＋ New configuration
          </a>
        </section>

        <SetupGuide layout={draft.layout} configId={saved?.id ?? null} giftName={mapping.selectedGiftName} />
      </aside>

      <main className="preview">
        <div className="preview-bar">
          <span className="hint">
            Preview · {draft.layout === '16:9' ? '1920×1080' : '1080×1920'} · {giftIcon(mapping.selectedGiftName)} {mapping.selectedGiftName} → {effect.label}
          </span>
        </div>
        <div className="preview-area">
          <div className={`preview-frame preview-frame--${draft.layout === '16:9' ? 'wide' : 'tall'}`} style={{ '--accent': s.colors[0] } as CSSProperties}>
            <OverlayStage
              effects={[]}
              settings={DEFAULT_SETTINGS}
              snow={false}
              snowSettings={DEFAULT_SNOW}
              testBadge
              resolvePlay={resolvePlay}
              apiRef={stageApi}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
