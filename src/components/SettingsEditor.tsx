import { DEFAULT_SETTINGS, LIMITS } from '../effects/settings';
import { EMITTERS, SHAPES, type EffectId, type EffectSettings } from '../effects/types';

interface Props {
  id: EffectId;
  value: EffectSettings;
  onChange: (value: EffectSettings) => void;
  onPreview: () => void;
}

const FILTER_HELP: Partial<Record<EffectId, string>> = {
  gift: 'Gift name that triggers it (e.g. Rose), or * for any gift',
  custom: 'Custom event name (e.g. share, subscribe), or * for any',
};

export function SettingsEditor({ id, value, onChange, onPreview }: Props) {
  const set = <K extends keyof EffectSettings>(key: K, v: EffectSettings[K]) => onChange({ ...value, [key]: v });

  const slider = (key: 'duration' | 'count' | 'size', label: string, unit: string) => (
    <label className="field">
      <span className="field-row">
        <span>{label}</span>
        <output>
          {key === 'duration' ? (value[key] / 1000).toFixed(1) : value[key]}
          {unit}
        </output>
      </span>
      <input type="range" {...LIMITS[key]} value={value[key]} onChange={(e) => set(key, Number(e.target.value))} />
    </label>
  );

  return (
    <div className="editor">
      {slider('duration', 'Duration', 's')}
      {slider('count', 'Particle count', '')}
      {slider('size', 'Particle size', 'px')}

      <div className="field">
        <span>Colors</span>
        <div className="colors">
          {value.colors.map((c, i) => (
            <span key={i} className="color">
              <input
                type="color"
                value={c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c}
                onChange={(e) => set('colors', value.colors.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Color ${i + 1}`}
              />
              {value.colors.length > 1 && (
                <button className="color-x" onClick={() => set('colors', value.colors.filter((_, j) => j !== i))} aria-label="Remove color">
                  ×
                </button>
              )}
            </span>
          ))}
          {value.colors.length < 8 && (
            <button className="color-add" onClick={() => set('colors', [...value.colors, '#ffffff'])} aria-label="Add color">
              +
            </button>
          )}
        </div>
      </div>

      <div className="field-pair">
        <label className="field">
          <span>Shape</span>
          <select value={value.shape} onChange={(e) => set('shape', e.target.value as EffectSettings['shape'])}>
            {SHAPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Motion</span>
          <select value={value.emitter} onChange={(e) => set('emitter', e.target.value as EffectSettings['emitter'])}>
            {EMITTERS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-pair field-pair--icon">
        <label className="field">
          <span>Icon</span>
          <input value={value.icon} onChange={(e) => set('icon', e.target.value)} maxLength={8} />
        </label>
        <label className="field">
          <span>Message</span>
          <input value={value.message} onChange={(e) => set('message', e.target.value)} maxLength={120} placeholder="empty = particles only" />
        </label>
      </div>
      <span className="hint">Placeholders: {'{user} {gift} {count} {likes} {name}'}</span>

      {FILTER_HELP[id] && (
        <label className="field">
          <span>Trigger filter</span>
          <input value={value.filter} onChange={(e) => set('filter', e.target.value)} maxLength={40} />
          <span className="hint">{FILTER_HELP[id]}</span>
        </label>
      )}

      <div className="row">
        <button className="btn primary" onClick={onPreview}>
          ▶ Preview
        </button>
        <button className="btn" onClick={() => onChange(structuredClone(DEFAULT_SETTINGS[id]))}>
          Reset
        </button>
      </div>
    </div>
  );
}
