import { useCallback, useEffect, useState } from 'react';
import { encodeJson } from '../../builder/repository/portable';
import { OwnershipError } from '../../builder/repository/types';
import { spotlightUrl } from '../../builder/route';
import { newId } from '../../builder/validate';
import { AppShell, Notice, PageHead, Segmented, StepCard, useToast } from '../../ui/AppShell';
import { useI18n, type Translate } from '../../ui/i18n';
import { ConnectionCard, LinkCard } from '../../ui/LinkCard';
import type { StringKey } from '../../ui/strings';
import { spotlightRepository } from '../repository';
import { addGift, addPerson, createSpotlight, type SpotlightState } from '../store';
import { SPOTLIGHT_ITEMS, SPOTLIGHT_STYLES, type SpotlightConfig, type SpotlightItem } from '../types';
import { newSpotlight, SPOTLIGHT_LIMITS, toPublicSpotlight } from '../validate';
import { demoGift, demoPerson } from './demo';
import { SpotlightView } from './SpotlightView';

const sameContent = (a: SpotlightConfig | null, b: SpotlightConfig) => !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });
const DEFAULT_NAMES = new Set(['Spotlight', 'آخر داعم وأكبر هدية']);
const ITEM_ICONS: Record<SpotlightItem, string> = { lastGift: '🎁', biggestGift: '🥇', lastFollow: '👥', lastShare: '🔁' };

/** Sample values for the style picker thumbnails. */
const SAMPLE: SpotlightState = (() => {
  let s = createSpotlight(0);
  s = addGift(s, { name: 'karim.dev', giftName: 'Lion', repeatCount: 1, diamondCount: 29999 }, 1);
  s = addGift(s, { name: 'sara.live', giftName: 'Rose', repeatCount: 5, diamondCount: 1 }, 2);
  s = addPerson(s, 'follow', 'omar_99', 3);
  return addPerson(s, 'share', 'lina.art', 4);
})();

function freshSpotlight(t: Translate): SpotlightConfig {
  return { ...newSpotlight(spotlightRepository.currentOwnerId()), name: t('spot.defaultName') };
}

export function SpotlightBuilderPage({ id }: { id: string | null }) {
  const { t } = useI18n();
  return (
    <AppShell active="spotlight" title={t('spot.title')}>
      <SpotlightWorkspace id={id} />
    </AppShell>
  );
}

function SpotlightWorkspace({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<SpotlightConfig>(() => freshSpotlight(t));
  const [saved, setSaved] = useState<SpotlightConfig | null>(null);
  const [mine, setMine] = useState<SpotlightConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  // Preview values are TEST data on this page only.
  const [preview, setPreview] = useState<SpotlightState>(SAMPLE);

  const refreshList = useCallback(() => spotlightRepository.listMine().then(setMine), []);

  useEffect(() => {
    let cancelled = false;
    setNotice(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        setDraft(freshSpotlight(t));
        setSaved(null);
        return;
      }
      const found = await spotlightRepository.get(id);
      if (cancelled) return;
      if (!found) {
        setNotice({ kind: 'error', text: t('common.notFound') });
        return;
      }
      setDraft(found);
      setSaved(found);
      if (found.ownerId !== spotlightRepository.currentOwnerId()) {
        setReadOnly(true);
        setNotice({ kind: 'info', text: t('common.readOnly') });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
    // t only provides defaults for a brand-new bar; switching language must not reset edits.
  }, [id, refreshList]);

  // A brand-new bar whose name was never edited follows the UI language.
  useEffect(() => {
    if (!saved) setDraft((d) => (DEFAULT_NAMES.has(d.name) ? { ...d, name: t('spot.defaultName') } : d));
  }, [t, saved]);

  const set = <K extends keyof SpotlightConfig>(key: K, value: SpotlightConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleItem = (item: SpotlightItem, on: boolean) => {
    const next = SPOTLIGHT_ITEMS.filter((i) => (i === item ? on : draft.items.includes(i)));
    if (next.length) set('items', next);
  };
  const dirty = !sameContent(saved, draft);
  const now = () => Date.now();

  const save = async () => {
    try {
      const record = await spotlightRepository.save(draft);
      setDraft(record);
      setSaved(record);
      setNotice(null);
      toast(t('common.savedToast'));
      refreshList();
      if (id !== record.id) window.location.hash = `#/spotlights/${record.id}`;
    } catch (e) {
      toast(e instanceof OwnershipError ? t('common.ownerError') : t('common.saveError'), 'error');
    }
  };

  const duplicate = () => {
    const ts = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: spotlightRepository.currentOwnerId(), name: `${draft.name} (2)`, createdAt: ts, updatedAt: ts, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setNotice({ kind: 'info', text: t('common.copyCreated') });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await spotlightRepository.save({ ...saved, enabled: !saved.enabled });
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('spot.confirmDelete', { name: saved.name }))) return;
    await spotlightRepository.remove(saved.id);
    window.location.hash = '#/spotlights';
    refreshList();
  };

  const url = saved ? spotlightUrl(saved.id, encodeJson(toPublicSpotlight(saved)), lang) : null;
  const storageUrl = saved ? spotlightUrl(saved.id, undefined, lang) : null;
  const viewProps = { items: draft.items, layout: draft.layout, rotateSeconds: draft.rotateSeconds, colors: draft.colors, lang };

  return (
    <div className="workspace">
      <div className="editor">
        <PageHead icon="🥇" title={t('spot.title')} subtitle={t('spot.subtitle')} />

        <label className="name-field">
          <span>{t('common.name')}</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={60} disabled={readOnly} />
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <StepCard n={1} title={t('spot.step1')} hint={t('spot.step1.hint')} disabled={readOnly}>
          <div className="item-list">
            {SPOTLIGHT_ITEMS.map((item) => (
              <label key={item} className="switch">
                <input type="checkbox" checked={draft.items.includes(item)} onChange={(e) => toggleItem(item, e.target.checked)} />
                <span>
                  {ITEM_ICONS[item]} {t(`spot.item.${item}` as StringKey)}
                </span>
              </label>
            ))}
          </div>
          <Segmented
            label={t('spot.layout')}
            value={draft.layout}
            options={[
              { value: 'stack', label: t('spot.layout.stack') },
              { value: 'rotate', label: t('spot.layout.rotate') },
            ]}
            onChange={(v) => set('layout', v)}
          />
          {draft.layout === 'rotate' && (
            <label className="field">
              <span className="field-row">
                <span>{t('spot.rotateSeconds')}</span>
                <output>{t('chat.seconds', { n: draft.rotateSeconds })}</output>
              </span>
              <input
                type="range"
                min={SPOTLIGHT_LIMITS.rotateSeconds.min}
                max={SPOTLIGHT_LIMITS.rotateSeconds.max}
                value={draft.rotateSeconds}
                onChange={(e) => set('rotateSeconds', Number(e.target.value))}
              />
            </label>
          )}
          {draft.items.includes('biggestGift') && <p className="muted small">{t('spot.biggestHint')}</p>}
        </StepCard>

        <StepCard n={2} title={t('spot.step2')} disabled={readOnly}>
          <div className="look-grid" role="radiogroup" aria-label={t('spot.step2')}>
            {SPOTLIGHT_STYLES.map((look) => (
              <button
                key={look}
                type="button"
                role="radio"
                aria-checked={draft.style === look}
                className={`look-card look-card--spot ${draft.style === look ? 'is-active' : ''}`}
                onClick={() => set('style', look)}
              >
                <span className="look-thumb">
                  <SpotlightView {...viewProps} state={SAMPLE} look={look} test={false} />
                </span>
                <b>{t(`spot.look.${look}` as StringKey)}</b>
              </button>
            ))}
          </div>
          <div className="field-pair">
            {([0, 1] as const).map((i) => (
              <label key={i} className="field field--color">
                <span>{i === 0 ? t('lb.accent') : t('lb.accent2')}</span>
                <input
                  type="color"
                  value={draft.colors[i]}
                  onChange={(e) => set('colors', (i === 0 ? [e.target.value, draft.colors[1]] : [draft.colors[0], e.target.value]) as [string, string])}
                />
              </label>
            ))}
          </div>
          <details className="disclosure">
            <summary>{t('common.advanced')}</summary>
            <label className="field">
              <span className="field-row">
                <span>{t('lb.gap')}</span>
                <output>{t('lb.hours', { n: draft.sessionGapHours })}</output>
              </span>
              <input
                type="range"
                min={SPOTLIGHT_LIMITS.sessionGapHours.min}
                max={SPOTLIGHT_LIMITS.sessionGapHours.max}
                value={draft.sessionGapHours}
                onChange={(e) => set('sessionGapHours', Number(e.target.value))}
              />
              <span className="muted small">{t('lb.gapHint')}</span>
            </label>
            <p className="muted small">{t('lb.resetHint', { setup: '&setup=1' })}</p>
          </details>
        </StepCard>

        <section className="card">
          <div className="card-row">
            <h2 className="card-title">📁 {t('spot.saved')}</h2>
            <a className="btn btn--small" href="#/spotlights" onClick={() => id === null && setDraft(freshSpotlight(t))}>
              ＋ {t('common.new')}
            </a>
          </div>
          {mine.length ? (
            <ul className="config-list">
              {mine.map((c) => (
                <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                  <a href={`#/spotlights/${c.id}`}>
                    <span className="gift-icon">🥇</span>
                    <span className="config-name">{c.name}</span>
                    <span className="muted small">
                      {c.items.map((i) => ITEM_ICONS[i]).join(' ')}
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
          <h2 className="card-title">👀 {t('common.preview')}</h2>
          <div className="side-preview side-preview--spot">
            <div className="spot-preview-frame">
              <SpotlightView {...viewProps} state={preview} look={draft.style} test />
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setPreview((s) => demoGift(s, now()))}>
              {t('lb.addSmall')}
            </button>
            <button type="button" className="btn" onClick={() => setPreview((s) => demoGift(s, now(), true))}>
              {t('lb.addBig')}
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setPreview((s) => demoPerson(s, 'follow', now()))}>
              {t('timer.testFollow')}
            </button>
            <button type="button" className="btn" onClick={() => setPreview((s) => demoPerson(s, 'share', now()))}>
              {t('spot.testShare')}
            </button>
            <button type="button" className="btn" onClick={() => setPreview(createSpotlight(now()))}>
              {t('lb.clear')}
            </button>
          </div>
          <p className="muted small">{t('spot.previewHint')}</p>
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

        <LinkCard
          url={url}
          storageUrl={storageUrl}
          dirty={!!saved && dirty}
          size={draft.layout === 'rotate' ? t('spot.sizeOne') : t('spot.sizeStack', { h: String(draft.items.length * 75 + 10) })}
        />
        <ConnectionCard configId={saved?.id ?? null} />
      </aside>
    </div>
  );
}
