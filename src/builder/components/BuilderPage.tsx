import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { OverlayStage, type StageApi } from '../../components/OverlayStage';
import { DEFAULT_SNOW } from '../../config/settings';
import { DEFAULT_SETTINGS } from '../../effects/settings';
import { makeEventId } from '../../events/eventBus';
import type { GiftEvent } from '../../events/types';
import { AppShell, ColorList, Notice, PageHead, Segmented, StepCard, useToast } from '../../ui/AppShell';
import { useI18n, type Translate } from '../../ui/i18n';
import { ConnectionCard, LinkCard } from '../../ui/LinkCard';
import type { StringKey } from '../../ui/strings';
import { BUILDER_EFFECTS } from '../effects';
import { giftIcon, searchGifts } from '../gifts';
import { sendTestGift } from '../giftEvents';
import { buildMappingPlay, resolveConfigPlay } from '../play';
import { encodePortable } from '../repository/portable';
import { repository } from '../repository/localRepository';
import { OwnershipError } from '../repository/types';
import { overlayUrl } from '../route';
import { SCHEMA_VERSION, type BuilderEffectId, type GiftMapping, type Intensity, type Layout, type OverlayConfig } from '../types';
import { defaultMapping, LIMITS, newId, sanitizeEffectSettings, toPublic } from '../validate';
import { EffectThumb } from './EffectThumb';

function newConfig(t: Translate): OverlayConfig {
  const now = new Date().toISOString();
  const mapping = defaultMapping();
  mapping.alertSettings.text = t('gift.defaultAlert');
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    ownerId: repository.currentOwnerId(),
    name: t('gift.defaultName'),
    layout: '16:9',
    mappings: [mapping],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

const sameContent = (a: OverlayConfig | null, b: OverlayConfig) =>
  !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });

const effectLabel = (t: Translate, id: BuilderEffectId) => t(`effect.${id}` as StringKey);
const effectDesc = (t: Translate, id: BuilderEffectId) => t(`effect.${id}.desc` as StringKey);

export function BuilderPage({ id }: { id: string | null }) {
  const { t } = useI18n();
  return (
    <AppShell active="gifts" title={t('gift.title')}>
      <BuilderWorkspace id={id} />
    </AppShell>
  );
}

function BuilderWorkspace({ id }: { id: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<OverlayConfig>(() => newConfig(t));
  const [saved, setSaved] = useState<OverlayConfig | null>(null);
  const [mine, setMine] = useState<OverlayConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const stageApi = useRef<StageApi | null>(null);

  const refreshList = useCallback(() => repository.listMine().then(setMine), []);

  // Load the configuration named in the route (or start a fresh one).
  useEffect(() => {
    let cancelled = false;
    setNotice(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        setDraft(newConfig(t));
        setSaved(null);
        return;
      }
      const found = await repository.get(id);
      if (cancelled) return;
      if (!found) {
        setNotice({ kind: 'error', text: t('common.notFound') });
        setDraft(newConfig(t));
        setSaved(null);
        return;
      }
      setDraft(found);
      setSaved(found);
      if (found.ownerId !== repository.currentOwnerId()) {
        setReadOnly(true);
        setNotice({ kind: 'info', text: t('common.readOnly') });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
    // t is only used for defaults of a brand-new draft; switching language must not reset edits.
  }, [id, refreshList]);

  const mapping = draft.mappings[0];
  const s = mapping.effectSettings;
  const dirty = !sameContent(saved, draft);

  const updateMapping = (patch: Partial<GiftMapping>) =>
    setDraft((d) => ({ ...d, mappings: [{ ...d.mappings[0], ...patch }, ...d.mappings.slice(1)] }));
  const updateSettings = (patch: Partial<GiftMapping['effectSettings']>) => updateMapping({ effectSettings: { ...mapping.effectSettings, ...patch } });
  const updateAlert = (patch: Partial<GiftMapping['alertSettings']>) => updateMapping({ alertSettings: { ...mapping.alertSettings, ...patch } });
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

  // Play once when the effect changes, so choosing feels immediate.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(preview, 150);
    return () => clearTimeout(timer);
  }, [mapping.effectId]);

  const save = async () => {
    try {
      const record = await repository.save(draft);
      setDraft(record);
      setSaved(record);
      setNotice(null);
      toast(t('common.savedToast'));
      refreshList();
      if (id !== record.id) window.location.hash = `#/builder/${record.id}`;
    } catch (e) {
      toast(e instanceof OwnershipError ? t('common.ownerError') : t('common.saveError'), 'error');
    }
  };

  const duplicate = () => {
    const now = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: repository.currentOwnerId(), name: `${draft.name} (2)`, createdAt: now, updatedAt: now, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setNotice({ kind: 'info', text: t('common.copyCreated') });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await repository.setEnabled(saved.id, !saved.enabled);
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('gift.confirmDelete', { name: saved.name }))) return;
    await repository.remove(saved.id);
    window.location.hash = '#/builder';
    refreshList();
  };

  const gifts = searchGifts(query);
  const customGift = query.trim() && !gifts.some((g) => g.name.toLowerCase() === query.trim().toLowerCase()) ? query.trim() : null;
  const portableUrl = saved ? overlayUrl(saved.id, encodePortable(toPublic(saved))) : null;
  const storageUrl = saved ? overlayUrl(saved.id) : null;

  return (
    <div className="workspace">
      <div className="editor">
        <PageHead icon="🎁" title={t('gift.title')} subtitle={t('gift.subtitle')} />

        <label className="name-field">
          <span>{t('common.name')}</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} disabled={readOnly} />
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <StepCard n={1} title={t('gift.step1')} hint={t('gift.step1.hint')} disabled={readOnly}>
          <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('gift.search')} aria-label={t('gift.search')} />
          <div className="gift-grid" role="listbox" aria-label={t('gift.step1')}>
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
                <span dir="ltr">{g.name}</span>
              </button>
            ))}
            {customGift && (
              <button type="button" className="gift gift--custom" onClick={() => updateMapping({ selectedGiftName: customGift, selectedGiftId: null })}>
                <span className="gift-icon">🎁</span>
                <span>{t('gift.useCustom', { name: customGift })}</span>
              </button>
            )}
          </div>
          <p className="selected-pill">
            {t('gift.selected')}: <b>{giftIcon(mapping.selectedGiftName)} <span dir="ltr">{mapping.selectedGiftName}</span></b>
          </p>
          <details className="disclosure">
            <summary>{t('common.advanced')}</summary>
            <p className="muted small">{t('gift.nameHint')}</p>
            <label className="field">
              <span>{t('gift.giftId')}</span>
              <input
                dir="ltr"
                value={mapping.selectedGiftId ?? ''}
                onChange={(e) => updateMapping({ selectedGiftId: e.target.value.replace(/[^\w-]/g, '').slice(0, 32) || null })}
              />
              <span className="muted small">{t('gift.giftIdHint')}</span>
            </label>
          </details>
        </StepCard>

        <StepCard n={2} title={t('gift.step2')} disabled={readOnly}>
          <div className="effect-gallery">
            {BUILDER_EFFECTS.map((e) => (
              <button key={e.id} type="button" className={`effect-card ${mapping.effectId === e.id ? 'is-active' : ''}`} onClick={() => chooseEffect(e.id)} aria-pressed={mapping.effectId === e.id}>
                <EffectThumb shapes={e.thumb} colors={mapping.effectId === e.id ? s.colors : e.defaults.colors} />
                <span className="effect-name">{effectLabel(t, e.id)}</span>
                <span className="muted small">{effectDesc(t, e.id)}</span>
              </button>
            ))}
          </div>
        </StepCard>

        <StepCard n={3} title={t('gift.step3')} disabled={readOnly}>
          <div className="field">
            <span>{t('gift.intensity')}</span>
            <Segmented<Intensity>
              label={t('gift.intensity')}
              value={s.intensity}
              onChange={(intensity) => updateSettings({ intensity })}
              options={[
                { value: 'low', label: t('gift.intensity.low') },
                { value: 'medium', label: t('gift.intensity.medium') },
                { value: 'high', label: t('gift.intensity.high') },
              ]}
            />
          </div>
          <div className="field">
            <span>{t('common.colors')}</span>
            <ColorList colors={s.colors} onChange={(colors) => updateSettings({ colors })} />
          </div>
          <label className="switch">
            <input type="checkbox" checked={mapping.alertSettings.enabled} onChange={(e) => updateAlert({ enabled: e.target.checked })} />
            <span>{t('gift.alert')}</span>
          </label>
          {mapping.alertSettings.enabled && (
            <div className="alert-fields">
              <label className="field field--icon">
                <span>{t('gift.alertIcon')}</span>
                <input value={mapping.alertSettings.icon} onChange={(e) => updateAlert({ icon: e.target.value })} maxLength={8} />
              </label>
              <label className="field">
                <span>{t('gift.alertText')}</span>
                <input value={mapping.alertSettings.text} onChange={(e) => updateAlert({ text: e.target.value })} maxLength={120} />
                <span className="muted small">{t('gift.alertHint')}</span>
              </label>
            </div>
          )}
          <details className="disclosure">
            <summary>{t('common.advanced')}</summary>
            {(
              [
                ['count', 'gift.count', ''],
                ['duration', 'gift.duration', 's'],
                ['size', 'gift.size', 'px'],
              ] as const
            ).map(([key, label, unit]) => (
              <label key={key} className="field">
                <span className="field-row">
                  <span>{t(label)}</span>
                  <output dir="ltr">
                    {key === 'duration' ? (s[key] / 1000).toFixed(1) : s[key]}
                    {unit}
                  </output>
                </span>
                <input type="range" min={LIMITS[key].min} max={LIMITS[key].max} step={key === 'duration' ? 100 : 1} value={s[key]} onChange={(e) => updateSettings({ [key]: Number(e.target.value) })} />
              </label>
            ))}
            <button type="button" className="btn btn--small" onClick={() => chooseEffect(mapping.effectId)}>
              ↺ {t('gift.resetEffect')}
            </button>
          </details>
        </StepCard>

        <section className="card">
          <div className="card-row">
            <h2 className="card-title">📁 {t('gift.saved')}</h2>
            <a className="btn btn--small" href="#/builder" onClick={() => id === null && setDraft(newConfig(t))}>
              ＋ {t('common.new')}
            </a>
          </div>
          {mine.length ? (
            <ul className="config-list">
              {mine.map((c) => (
                <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                  <a href={`#/builder/${c.id}`}>
                    <span className="gift-icon">{giftIcon(c.mappings[0].selectedGiftName)}</span>
                    <span className="config-name">{c.name}</span>
                    <span className="muted small">
                      <span dir="ltr">{c.mappings[0].selectedGiftName}</span> → {effectLabel(t, c.mappings[0].effectId)}
                      {!c.enabled && ' · ⏸'}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t('common.empty')}</p>
          )}
          <p className="muted small">💾 {t('common.localHint')}</p>
        </section>
      </div>

      <aside className="side">
        <section className="card preview-card">
          <div className="card-row">
            <h2 className="card-title">👀 {t('common.preview')}</h2>
            <Segmented<Layout>
              label={t('common.layout')}
              value={draft.layout}
              onChange={(layout) => setDraft({ ...draft, layout })}
              options={[
                { value: '16:9', label: '16:9' },
                { value: '9:16', label: '9:16' },
              ]}
            />
          </div>
          <div className="side-preview">
            <div className={`preview-frame preview-frame--${draft.layout === '16:9' ? 'wide' : 'tall'}`} style={{ '--accent': s.colors[0] } as CSSProperties}>
              <OverlayStage effects={[]} settings={DEFAULT_SETTINGS} snow={false} snowSettings={DEFAULT_SNOW} testBadge resolvePlay={resolvePlay} apiRef={stageApi} />
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={preview}>
              ▶ {t('common.preview')}
            </button>
            <button type="button" className="btn" onClick={test}>
              🧪 {t('common.test')}
            </button>
          </div>
          <p className="muted small">{t('gift.previewHint')}</p>
        </section>

        <section className="card save-card">
          {readOnly ? (
            <button type="button" className="btn primary btn--big" onClick={duplicate}>
              {t('common.duplicate')}
            </button>
          ) : (
            <button type="button" className={`btn btn--big ${dirty || !saved ? 'primary' : ''}`} onClick={save} disabled={!dirty && !!saved}>
              {saved ? (dirty ? `💾 ${t('common.saveChanges')}` : `✓ ${t('common.saved')}`) : `💾 ${t('common.save')}`}
            </button>
          )}
          {saved && !saved.enabled && <Notice kind="error">{t('common.paused')}</Notice>}
          {saved && !readOnly && (
            <div className="row row--quiet">
              <button type="button" className="btn btn--small" onClick={toggleEnabled}>
                {saved.enabled ? `⏸ ${t('common.disable')}` : `▶ ${t('common.enable')}`}
              </button>
              <button type="button" className="btn btn--small btn--danger" onClick={remove}>
                🗑 {t('common.delete')}
              </button>
            </div>
          )}
        </section>

        <LinkCard url={portableUrl} storageUrl={storageUrl} dirty={!!saved && dirty} size={draft.layout === '16:9' ? '1920 × 1080' : '1080 × 1920'} />
        <ConnectionCard configId={saved?.id ?? null} />
      </aside>
    </div>
  );
}
