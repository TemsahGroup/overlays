import { useCallback, useEffect, useState } from 'react';
import { encodeJson } from '../../builder/repository/portable';
import { OwnershipError } from '../../builder/repository/types';
import { goalUrl } from '../../builder/route';
import { newId } from '../../builder/validate';
import { AppShell, Notice, PageHead, StepCard, useToast } from '../../ui/AppShell';
import { useI18n, type Translate } from '../../ui/i18n';
import { ConnectionCard, LinkCard } from '../../ui/LinkCard';
import type { StringKey } from '../../ui/strings';
import { goalRepository } from '../repository';
import { addAmount, createProgress, progressValue, type GoalProgress } from '../store';
import { GOAL_METRICS, GOAL_STYLES, type GoalConfig, type GoalMetric } from '../types';
import { GOAL_LIMITS, METRIC_DEFAULTS, newGoal, toPublicGoal } from '../validate';
import { demoStep } from './demo';
import { GoalView, metricIcon } from './GoalView';

const sameContent = (a: GoalConfig | null, b: GoalConfig) => !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });

const defaultTitle = (t: Translate, metric: GoalMetric) => t(`goal.default.${metric}` as StringKey);
/** Titles never edited by the user (any language) follow the metric. */
const DEFAULT_TITLES = new Set(['Coin goal', 'Like goal', 'Follow goal', 'Share goal', 'هدف العملات', 'هدف اللايكات', 'هدف المتابعين', 'هدف المشاركات']);

function freshGoal(t: Translate, metric: GoalMetric = 'coins'): GoalConfig {
  const goal = newGoal(goalRepository.currentOwnerId(), metric);
  return { ...goal, name: defaultTitle(t, metric), title: defaultTitle(t, metric) };
}

/** Preview progress at about 60% of the target. */
const startPreview = (target: number) => addAmount(createProgress(Date.now()), Math.round(target * 0.6), Date.now());

export function GoalBuilderPage({ id }: { id: string | null }) {
  const { t } = useI18n();
  return (
    <AppShell active="goal" title={t('goal.title')}>
      <GoalWorkspace id={id} />
    </AppShell>
  );
}

function GoalWorkspace({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<GoalConfig>(() => freshGoal(t));
  const [saved, setSaved] = useState<GoalConfig | null>(null);
  const [mine, setMine] = useState<GoalConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  // Preview progress is TEST data on this page only (stored in "amount" for every metric).
  const [preview, setPreview] = useState<GoalProgress>(() => startPreview(draft.target));

  const refreshList = useCallback(() => goalRepository.listMine().then(setMine), []);

  useEffect(() => {
    let cancelled = false;
    setNotice(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        const fresh = freshGoal(t);
        setDraft(fresh);
        setSaved(null);
        setPreview(startPreview(fresh.target));
        return;
      }
      const found = await goalRepository.get(id);
      if (cancelled) return;
      if (!found) {
        setNotice({ kind: 'error', text: t('common.notFound') });
        return;
      }
      setDraft(found);
      setSaved(found);
      setPreview(startPreview(found.target));
      if (found.ownerId !== goalRepository.currentOwnerId()) {
        setReadOnly(true);
        setNotice({ kind: 'info', text: t('common.readOnly') });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
    // t only provides defaults for a brand-new goal; switching language must not reset edits.
  }, [id, refreshList]);

  // A brand-new goal whose title was never edited follows the UI language.
  useEffect(() => {
    if (saved) return;
    setDraft((d) => ({
      ...d,
      title: DEFAULT_TITLES.has(d.title) ? defaultTitle(t, d.metric) : d.title,
      name: DEFAULT_TITLES.has(d.name) ? defaultTitle(t, d.metric) : d.name,
    }));
  }, [t, saved]);

  const set = <K extends keyof GoalConfig>(key: K, value: GoalConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = !sameContent(saved, draft);

  const setMetric = (metric: GoalMetric) => {
    const d = METRIC_DEFAULTS[metric];
    setDraft((c) => ({
      ...c,
      metric,
      target: d.target,
      colors: [...d.colors] as [string, string],
      title: DEFAULT_TITLES.has(c.title) ? defaultTitle(t, metric) : c.title,
      name: DEFAULT_TITLES.has(c.name) ? defaultTitle(t, metric) : c.name,
    }));
    setPreview(startPreview(d.target));
  };

  const save = async () => {
    try {
      const record = await goalRepository.save(draft);
      setDraft(record);
      setSaved(record);
      setNotice(null);
      toast(t('common.savedToast'));
      refreshList();
      if (id !== record.id) window.location.hash = `#/goals/${record.id}`;
    } catch (e) {
      toast(e instanceof OwnershipError ? t('common.ownerError') : t('common.saveError'), 'error');
    }
  };

  const duplicate = () => {
    const ts = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: goalRepository.currentOwnerId(), name: `${draft.name} (2)`, createdAt: ts, updatedAt: ts, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setNotice({ kind: 'info', text: t('common.copyCreated') });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await goalRepository.save({ ...saved, enabled: !saved.enabled });
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('goal.confirmDelete', { name: saved.name }))) return;
    await goalRepository.remove(saved.id);
    window.location.hash = '#/goals';
    refreshList();
  };

  const url = saved ? goalUrl(saved.id, encodeJson(toPublicGoal(saved)), lang) : null;
  const storageUrl = saved ? goalUrl(saved.id, undefined, lang) : null;
  const now = () => Date.now();
  const viewProps = { title: draft.title, metric: draft.metric, mode: 'coins' as const, target: draft.target, autoNext: draft.autoNext, colors: draft.colors, lang };

  return (
    <div className="workspace">
      <div className="editor">
        <PageHead icon="🎯" title={t('goal.title')} subtitle={t('goal.subtitle')} />

        <label className="name-field">
          <span>{t('common.name')}</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={60} disabled={readOnly} />
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <StepCard n={1} title={t('goal.step1')} disabled={readOnly}>
          <div className="choice-grid">
            {GOAL_METRICS.map((m) => (
              <button key={m} type="button" className={`choice ${draft.metric === m ? 'is-active' : ''}`} onClick={() => setMetric(m)} aria-pressed={draft.metric === m}>
                <span className="choice-icon">{metricIcon(m, 'coins')}</span>
                <b>{t(`goal.metric.${m}` as StringKey)}</b>
                <span className="muted small">{t(`goal.metric.${m}.hint` as StringKey)}</span>
              </button>
            ))}
          </div>
        </StepCard>

        <StepCard n={2} title={t('goal.step2')} disabled={readOnly}>
          <div className="look-grid" role="radiogroup" aria-label={t('goal.step2')}>
            {GOAL_STYLES.map((look) => (
              <button
                key={look}
                type="button"
                role="radio"
                aria-checked={draft.style === look}
                className={`look-card look-card--goal ${draft.style === look ? 'is-active' : ''}`}
                onClick={() => set('style', look)}
              >
                <span className="look-thumb">
                  <GoalView {...viewProps} value={Math.round(draft.target * 0.65)} autoNext={false} look={look} test={false} />
                </span>
                <b>{t(`goal.look.${look}` as StringKey)}</b>
              </button>
            ))}
          </div>
        </StepCard>

        <StepCard n={3} title={t('goal.step3')} disabled={readOnly}>
          <label className="field">
            <span>{t('goal.target', { unit: t(`goal.unit.${draft.metric}` as StringKey) })}</span>
            <input
              type="number"
              min={GOAL_LIMITS.target.min}
              max={GOAL_LIMITS.target.max}
              value={draft.target}
              onChange={(e) => set('target', Math.min(GOAL_LIMITS.target.max, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
              onBlur={() => setDraft((d) => ({ ...d, target: Math.max(GOAL_LIMITS.target.min, d.target) }))}
            />
          </label>
          <label className="field">
            <span>{t('lb.titleOnStream')}</span>
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={40} />
          </label>
          <label className="switch">
            <input type="checkbox" checked={draft.autoNext} onChange={(e) => set('autoNext', e.target.checked)} />
            <span>{t('goal.autoNext')}</span>
          </label>
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
                min={GOAL_LIMITS.sessionGapHours.min}
                max={GOAL_LIMITS.sessionGapHours.max}
                value={draft.sessionGapHours}
                onChange={(e) => set('sessionGapHours', Number(e.target.value))}
              />
              <span className="muted small">{t('goal.gapHint')}</span>
            </label>
            <p className="muted small">{t('goal.resetHint', { setup: '&setup=1' })}</p>
          </details>
        </StepCard>

        <section className="card">
          <div className="card-row">
            <h2 className="card-title">📁 {t('goal.saved')}</h2>
            <a className="btn btn--small" href="#/goals" onClick={() => id === null && setDraft(freshGoal(t))}>
              ＋ {t('common.new')}
            </a>
          </div>
          {mine.length ? (
            <ul className="config-list">
              {mine.map((c) => (
                <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                  <a href={`#/goals/${c.id}`}>
                    <span className="gift-icon">{metricIcon(c.metric, 'coins')}</span>
                    <span className="config-name">{c.name}</span>
                    <span className="muted small">
                      {t(`goal.metric.${c.metric}` as StringKey)} · {c.target.toLocaleString('en')}
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
          <div className="side-preview side-preview--goal">
            <div className={`goal-preview-frame goal-preview-frame--${draft.style}`}>
              <GoalView {...viewProps} value={progressValue(preview, false)} look={draft.style} test />
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setPreview((p) => demoStep({ ...p }, 'likes', draft.target, now()))}>
              {t('goal.addSome')}
            </button>
            <button type="button" className="btn" onClick={() => setPreview((p) => addAmount(p, Math.ceil(draft.target / 4), now()))}>
              {t('goal.addBig')}
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => setPreview(startPreview(draft.target))}>
              ↺ {t('goal.previewReset')}
            </button>
            <button type="button" className="btn" onClick={() => setPreview(createProgress(now()))}>
              {t('lb.clear')}
            </button>
          </div>
          <p className="muted small">{t('goal.previewHint')}</p>
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

        <LinkCard url={url} storageUrl={storageUrl} dirty={!!saved && dirty} size={t(draft.style === 'ring' ? 'goal.sizeRing' : 'goal.sizeBar')} />
        <ConnectionCard configId={saved?.id ?? null} />
      </aside>
    </div>
  );
}
