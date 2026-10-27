import { useCallback, useEffect, useState } from 'react';
import { giftIcon, searchGifts } from '../../builder/gifts';
import { encodeJson } from '../../builder/repository/portable';
import { OwnershipError } from '../../builder/repository/types';
import { wheelUrl } from '../../builder/route';
import { newId } from '../../builder/validate';
import { AppShell, Notice, PageHead, Segmented, StepCard, useToast } from '../../ui/AppShell';
import { useI18n, type Translate } from '../../ui/i18n';
import { ConnectionCard, LinkCard } from '../../ui/LinkCard';
import type { StringKey } from '../../ui/strings';
import { wheelRepository } from '../repository';
import { WHEEL_STYLES, type WheelConfig, type WheelSegment } from '../types';
import { newWheel, presetSegments, SEGMENT_COLORS, toPublicWheel, WHEEL_LIMITS, type PresetKey } from '../validate';
import { useWheelSpinner } from './useWheelSpinner';
import { WheelView } from './WheelView';

const sameContent = (a: WheelConfig | null, b: WheelConfig) => !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });
const DEFAULT_TITLES = new Set(['Wheel of fortune', 'عجلة الحظ']);
const PRESET_KEYS: PresetKey[] = ['challenges', 'prizes', 'yesno'];

function freshWheel(t: Translate, lang: 'ar' | 'en'): WheelConfig {
  const wheel = newWheel(wheelRepository.currentOwnerId());
  return { ...wheel, name: t('wheel.defaultTitle'), title: t('wheel.defaultTitle'), segments: presetSegments('challenges', lang) };
}

export function WheelBuilderPage({ id }: { id: string | null }) {
  const { t } = useI18n();
  return (
    <AppShell active="wheel" title={t('wheel.title')}>
      <WheelWorkspace id={id} />
    </AppShell>
  );
}

function WheelWorkspace({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<WheelConfig>(() => freshWheel(t, lang));
  const [saved, setSaved] = useState<WheelConfig | null>(null);
  const [mine, setMine] = useState<WheelConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const spinner = useWheelSpinner(draft.segments.length, draft.spinSeconds);

  const refreshList = useCallback(() => wheelRepository.listMine().then(setMine), []);

  useEffect(() => {
    let cancelled = false;
    setNotice(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        setDraft(freshWheel(t, lang));
        setSaved(null);
        return;
      }
      const found = await wheelRepository.get(id);
      if (cancelled) return;
      if (!found) {
        setNotice({ kind: 'error', text: t('common.notFound') });
        return;
      }
      setDraft(found);
      setSaved(found);
      if (found.ownerId !== wheelRepository.currentOwnerId()) {
        setReadOnly(true);
        setNotice({ kind: 'info', text: t('common.readOnly') });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
    // t/lang only provide defaults for a brand-new wheel; switching language must not reset edits.
  }, [id, refreshList]);

  // A brand-new wheel whose title was never edited follows the UI language.
  useEffect(() => {
    if (saved) return;
    setDraft((d) => ({
      ...d,
      title: DEFAULT_TITLES.has(d.title) ? t('wheel.defaultTitle') : d.title,
      name: DEFAULT_TITLES.has(d.name) ? t('wheel.defaultTitle') : d.name,
    }));
  }, [t, saved]);

  const set = <K extends keyof WheelConfig>(key: K, value: WheelConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setSegment = (i: number, patch: Partial<WheelSegment>) => set('segments', draft.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addSegment = () =>
    set('segments', [...draft.segments, { label: `${t('wheel.option')} ${draft.segments.length + 1}`, color: SEGMENT_COLORS[draft.segments.length % SEGMENT_COLORS.length] }]);
  const removeSegment = (i: number) => set('segments', draft.segments.filter((_, j) => j !== i));
  const dirty = !sameContent(saved, draft);
  const labelsOk = draft.segments.every((s) => s.label.trim());

  const save = async () => {
    if (!labelsOk) {
      toast(t('wheel.emptyLabel'), 'error');
      return;
    }
    try {
      const record = await wheelRepository.save(draft);
      setDraft(record);
      setSaved(record);
      setNotice(null);
      toast(t('common.savedToast'));
      refreshList();
      if (id !== record.id) window.location.hash = `#/wheels/${record.id}`;
    } catch (e) {
      toast(e instanceof OwnershipError ? t('common.ownerError') : t('common.saveError'), 'error');
    }
  };

  const duplicate = () => {
    const ts = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: wheelRepository.currentOwnerId(), name: `${draft.name} (2)`, createdAt: ts, updatedAt: ts, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setNotice({ kind: 'info', text: t('common.copyCreated') });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await wheelRepository.save({ ...saved, enabled: !saved.enabled });
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('wheel.confirmDelete', { name: saved.name }))) return;
    await wheelRepository.remove(saved.id);
    window.location.hash = '#/wheels';
    refreshList();
  };

  const url = saved ? wheelUrl(saved.id, encodeJson(toPublicWheel(saved)), lang) : null;
  const storageUrl = saved ? wheelUrl(saved.id, undefined, lang) : null;
  const gifts = searchGifts(query);
  const customGift = query.trim() && !gifts.some((g) => g.name.toLowerCase() === query.trim().toLowerCase()) ? query.trim().slice(0, 60) : '';
  const hubIcon = draft.trigger === 'gift' ? giftIcon(draft.giftName) : '🪙';
  const idle = { rotation: 0, spinning: false, spinSeconds: draft.spinSeconds, result: null, queued: 0, hubIcon, visible: true, test: false, lang };

  return (
    <div className="workspace">
      <div className="editor">
        <PageHead icon="🎡" title={t('wheel.title')} subtitle={t('wheel.subtitle')} />

        <label className="name-field">
          <span>{t('common.name')}</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={60} disabled={readOnly} />
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <StepCard n={1} title={t('wheel.step1')} disabled={readOnly}>
          <div className="chip-filter" role="group" aria-label={t('wheel.presets')}>
            <span className="muted small">{t('wheel.presets')}:</span>
            {PRESET_KEYS.map((k) => (
              <button key={k} type="button" onClick={() => set('segments', presetSegments(k, lang))}>
                {t(`wheel.preset.${k}` as StringKey)}
              </button>
            ))}
          </div>
          <ol className="segment-list">
            {draft.segments.map((s, i) => (
              <li key={i}>
                <span className="segment-n">{i + 1}</span>
                <input type="color" value={s.color} onChange={(e) => setSegment(i, { color: e.target.value })} aria-label={t('wheel.color')} />
                <input value={s.label} onChange={(e) => setSegment(i, { label: e.target.value.slice(0, WHEEL_LIMITS.label) })} maxLength={WHEEL_LIMITS.label} dir="auto" aria-label={t('wheel.option')} />
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => removeSegment(i)}
                  disabled={draft.segments.length <= WHEEL_LIMITS.segments.min}
                  aria-label={t('common.delete')}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          {draft.segments.length < WHEEL_LIMITS.segments.max && (
            <button type="button" className="btn" onClick={addSegment}>
              ＋ {t('wheel.add')}
            </button>
          )}
          {!labelsOk && <Notice kind="error">{t('wheel.emptyLabel')}</Notice>}
        </StepCard>

        <StepCard n={2} title={t('wheel.step2')} disabled={readOnly}>
          <Segmented
            label={t('wheel.step2')}
            value={draft.trigger}
            options={[
              { value: 'gift', label: `🎁 ${t('wheel.trigger.gift')}` },
              { value: 'coins', label: `🪙 ${t('wheel.trigger.coins')}` },
            ]}
            onChange={(v) => set('trigger', v)}
          />
          {draft.trigger === 'gift' ? (
            <>
              <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('gift.search')} aria-label={t('gift.search')} />
              <div className="gift-grid" role="listbox" aria-label={t('wheel.trigger.gift')}>
                {gifts.map((g) => (
                  <button key={g.name} type="button" role="option" aria-selected={draft.giftName === g.name} className={`gift ${draft.giftName === g.name ? 'is-active' : ''}`} onClick={() => set('giftName', g.name)}>
                    <span className="gift-icon">{g.icon}</span>
                    <span dir="ltr">{g.name}</span>
                  </button>
                ))}
                {customGift && (
                  <button type="button" className="gift gift--custom" onClick={() => set('giftName', customGift)}>
                    <span className="gift-icon">🎁</span>
                    <span>{t('gift.useCustom', { name: customGift })}</span>
                  </button>
                )}
              </div>
              <p className="selected-pill">
                {t('gift.selected')}: <b>{giftIcon(draft.giftName)} <span dir="ltr">{draft.giftName}</span></b>
              </p>
              <label className="switch">
                <input type="checkbox" checked={draft.spinEach} onChange={(e) => set('spinEach', e.target.checked)} />
                <span>{t('wheel.spinEach')}</span>
              </label>
            </>
          ) : (
            <label className="field">
              <span>{t('wheel.minCoins')}</span>
              <input
                type="number"
                min={WHEEL_LIMITS.minCoins.min}
                max={WHEEL_LIMITS.minCoins.max}
                value={draft.minCoins}
                onChange={(e) => set('minCoins', Math.min(WHEEL_LIMITS.minCoins.max, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
                onBlur={() => setDraft((d) => ({ ...d, minCoins: Math.max(WHEEL_LIMITS.minCoins.min, d.minCoins) }))}
              />
              <span className="muted small">{t('wheel.minCoinsHint')}</span>
            </label>
          )}
        </StepCard>

        <StepCard n={3} title={t('wheel.step3')} disabled={readOnly}>
          <div className="look-grid" role="radiogroup" aria-label={t('wheel.step3')}>
            {WHEEL_STYLES.map((look) => (
              <button
                key={look}
                type="button"
                role="radio"
                aria-checked={draft.style === look}
                className={`look-card look-card--wheel ${draft.style === look ? 'is-active' : ''}`}
                onClick={() => set('style', look)}
              >
                <span className="look-thumb">
                  <WheelView {...idle} title={draft.title} segments={draft.segments} look={look} />
                </span>
                <b>{t(`wheel.look.${look}` as StringKey)}</b>
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t('lb.titleOnStream')}</span>
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={40} />
          </label>
          <label className="field">
            <span className="field-row">
              <span>{t('wheel.spinSeconds')}</span>
              <output>{t('chat.seconds', { n: draft.spinSeconds })}</output>
            </span>
            <input type="range" min={WHEEL_LIMITS.spinSeconds.min} max={WHEEL_LIMITS.spinSeconds.max} value={draft.spinSeconds} onChange={(e) => set('spinSeconds', Number(e.target.value))} />
          </label>
          <label className="switch">
            <input type="checkbox" checked={draft.hideWhenIdle} onChange={(e) => set('hideWhenIdle', e.target.checked)} />
            <span>{t('wheel.hideWhenIdle')}</span>
          </label>
        </StepCard>

        <section className="card">
          <div className="card-row">
            <h2 className="card-title">📁 {t('wheel.saved')}</h2>
            <a className="btn btn--small" href="#/wheels" onClick={() => id === null && setDraft(freshWheel(t, lang))}>
              ＋ {t('common.new')}
            </a>
          </div>
          {mine.length ? (
            <ul className="config-list">
              {mine.map((c) => (
                <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                  <a href={`#/wheels/${c.id}`}>
                    <span className="gift-icon">🎡</span>
                    <span className="config-name">{c.name}</span>
                    <span className="muted small">
                      {t('wheel.options', { n: c.segments.length })} · {c.trigger === 'gift' ? `${giftIcon(c.giftName)} ${c.giftName}` : `🪙 ≥ ${c.minCoins}`}
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
          <div className="side-preview side-preview--wheel">
            <div className="wheel-preview-frame">
              <WheelView
                {...idle}
                title={draft.title}
                segments={draft.segments}
                look={draft.style}
                rotation={spinner.rotation}
                spinning={spinner.spinning}
                result={spinner.result}
                queued={spinner.queued}
                test
              />
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => spinner.enqueue('test_viewer')}>
              🎡 {t('wheel.spin')}
            </button>
            <button type="button" className="btn" onClick={() => spinner.enqueue('test_viewer', 3)}>
              {t('wheel.spin3')}
            </button>
          </div>
          <p className="muted small">{t('wheel.previewHint')}</p>
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

        <LinkCard url={url} storageUrl={storageUrl} dirty={!!saved && dirty} size={t('wheel.size')} />
        <ConnectionCard configId={saved?.id ?? null} />
      </aside>
    </div>
  );
}
