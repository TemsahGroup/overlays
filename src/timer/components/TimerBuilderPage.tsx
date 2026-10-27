import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeJson } from '../../builder/repository/portable';
import { OwnershipError } from '../../builder/repository/types';
import { timerUrl } from '../../builder/route';
import { newId } from '../../builder/validate';
import { AppShell, Notice, PageHead, StepCard, useToast } from '../../ui/AppShell';
import { useI18n, type Translate } from '../../ui/i18n';
import { ConnectionCard, LinkCard } from '../../ui/LinkCard';
import type { StringKey } from '../../ui/strings';
import { timerRepository } from '../repository';
import { addTime, createTimer, formatAdd, giftSeconds, pause, resume, timeLeft, type TimerState } from '../store';
import { TIMER_STYLES, type TimerConfig, type TimerRules } from '../types';
import { newTimer, TIMER_LIMITS, toPublicTimer } from '../validate';
import { TimerView, type TimerAdd } from './TimerView';

const sameContent = (a: TimerConfig | null, b: TimerConfig) => !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });
const DEFAULT_TITLES = new Set(['Gift timer', 'تايمر الهدايا']);
const QUICK_MINUTES = [30, 60, 120, 240];
const RULE_KEYS: (keyof TimerRules)[] = ['perCoin', 'perFollow', 'perShare', 'per100Likes'];
const RULE_ICONS: Record<keyof TimerRules, string> = { perCoin: '🪙', perFollow: '👥', perShare: '🔁', per100Likes: '❤️' };

function freshTimer(t: Translate): TimerConfig {
  return { ...newTimer(timerRepository.currentOwnerId()), name: t('timer.defaultTitle'), title: t('timer.defaultTitle') };
}

const clampInt = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(v) || 0)));

export function TimerBuilderPage({ id }: { id: string | null }) {
  const { t } = useI18n();
  return (
    <AppShell active="timer" title={t('timer.title')}>
      <TimerWorkspace id={id} />
    </AppShell>
  );
}

function TimerWorkspace({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<TimerConfig>(() => freshTimer(t));
  const [saved, setSaved] = useState<TimerConfig | null>(null);
  const [mine, setMine] = useState<TimerConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  // Preview countdown is TEST data on this page only.
  const [preview, setPreview] = useState<TimerState>(() => createTimer(draft.startMinutes * 60_000, Date.now(), true));
  const [adds, setAdds] = useState<TimerAdd[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const refreshList = useCallback(() => timerRepository.listMine().then(setMine), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setNotice(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        setDraft(freshTimer(t));
        setSaved(null);
        return;
      }
      const found = await timerRepository.get(id);
      if (cancelled) return;
      if (!found) {
        setNotice({ kind: 'error', text: t('common.notFound') });
        return;
      }
      setDraft(found);
      setSaved(found);
      if (found.ownerId !== timerRepository.currentOwnerId()) {
        setReadOnly(true);
        setNotice({ kind: 'info', text: t('common.readOnly') });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
    // t only provides defaults for a brand-new timer; switching language must not reset edits.
  }, [id, refreshList]);

  // A brand-new timer whose title was never edited follows the UI language.
  useEffect(() => {
    if (saved) return;
    setDraft((d) => ({
      ...d,
      title: DEFAULT_TITLES.has(d.title) ? t('timer.defaultTitle') : d.title,
      name: DEFAULT_TITLES.has(d.name) ? t('timer.defaultTitle') : d.name,
    }));
  }, [t, saved]);

  // The preview restarts whenever the starting time changes.
  useEffect(() => {
    setPreview(createTimer(draft.startMinutes * 60_000, Date.now(), true));
  }, [draft.startMinutes]);

  useEffect(() => {
    if (!adds.length) return;
    const timer = setTimeout(() => setAdds((list) => list.slice(1)), 2700);
    return () => clearTimeout(timer);
  }, [adds]);

  const set = <K extends keyof TimerConfig>(key: K, value: TimerConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setRule = (key: keyof TimerRules, value: number) => setDraft((d) => ({ ...d, rules: { ...d.rules, [key]: value } }));
  const dirty = !sameContent(saved, draft);

  const testAdd = (seconds: number, name: string, icon: string) => {
    const prev = previewRef.current;
    const next = addTime(prev, seconds * 1000, Date.now(), draft.maxHours * 3_600_000);
    if (next === prev) return;
    setPreview(next);
    setAdds((list) => [...list, { id: Date.now() + Math.random(), seconds, name, icon }].slice(-5));
  };

  const save = async () => {
    try {
      const record = await timerRepository.save(draft);
      setDraft(record);
      setSaved(record);
      setNotice(null);
      toast(t('common.savedToast'));
      refreshList();
      if (id !== record.id) window.location.hash = `#/timers/${record.id}`;
    } catch (e) {
      toast(e instanceof OwnershipError ? t('common.ownerError') : t('common.saveError'), 'error');
    }
  };

  const duplicate = () => {
    const ts = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: timerRepository.currentOwnerId(), name: `${draft.name} (2)`, createdAt: ts, updatedAt: ts, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setNotice({ kind: 'info', text: t('common.copyCreated') });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await timerRepository.save({ ...saved, enabled: !saved.enabled });
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('timer.confirmDelete', { name: saved.name }))) return;
    await timerRepository.remove(saved.id);
    window.location.hash = '#/timers';
    refreshList();
  };

  const url = saved ? timerUrl(saved.id, encodeJson(toPublicTimer(saved)), lang) : null;
  const storageUrl = saved ? timerUrl(saved.id, undefined, lang) : null;
  const viewProps = { title: draft.title, colors: draft.colors, rules: draft.rules, showRules: draft.showRules, lang };

  return (
    <div className="workspace">
      <div className="editor">
        <PageHead icon="⏱️" title={t('timer.title')} subtitle={t('timer.subtitle')} />

        <label className="name-field">
          <span>{t('common.name')}</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={60} disabled={readOnly} />
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <StepCard n={1} title={t('timer.step1')} disabled={readOnly}>
          <label className="field">
            <span>{t('timer.start')}</span>
            <input
              type="number"
              min={TIMER_LIMITS.startMinutes.min}
              max={TIMER_LIMITS.startMinutes.max}
              value={draft.startMinutes}
              onChange={(e) => set('startMinutes', clampInt(e.target.value, TIMER_LIMITS.startMinutes.min, TIMER_LIMITS.startMinutes.max))}
            />
          </label>
          <div className="chip-filter" role="group" aria-label={t('timer.start')}>
            {QUICK_MINUTES.map((m) => (
              <button key={m} type="button" className={draft.startMinutes === m ? 'is-active' : ''} onClick={() => set('startMinutes', m)}>
                {m < 60 ? t('timer.minutes', { n: m }) : t('timer.hours', { n: m / 60 })}
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t('timer.max')}</span>
            <input
              type="number"
              min={TIMER_LIMITS.maxHours.min}
              max={TIMER_LIMITS.maxHours.max}
              value={draft.maxHours}
              onChange={(e) => set('maxHours', clampInt(e.target.value, TIMER_LIMITS.maxHours.min, TIMER_LIMITS.maxHours.max))}
            />
            <span className="muted small">{t('timer.maxHint')}</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={draft.autoStart} onChange={(e) => set('autoStart', e.target.checked)} />
            <span>{t('timer.autoStart')}</span>
          </label>
        </StepCard>

        <StepCard n={2} title={t('timer.step2')} hint={t('timer.step2.hint')} disabled={readOnly}>
          <div className="rule-grid">
            {RULE_KEYS.map((k) => (
              <label key={k} className="field">
                <span>
                  {RULE_ICONS[k]} {t(`timer.rule.${k}` as StringKey)}
                </span>
                <input
                  type="number"
                  min={TIMER_LIMITS.perRule.min}
                  max={TIMER_LIMITS.perRule.max}
                  value={draft.rules[k]}
                  onChange={(e) => setRule(k, clampInt(e.target.value, TIMER_LIMITS.perRule.min, TIMER_LIMITS.perRule.max))}
                />
              </label>
            ))}
          </div>
          <p className="muted small">
            {t('timer.example', {
              rose: formatAdd(giftSeconds(draft.rules, { repeatCount: 1, diamondCount: 1 })),
              hundred: formatAdd(giftSeconds(draft.rules, { repeatCount: 1, diamondCount: 100 })),
            })}
          </p>
        </StepCard>

        <StepCard n={3} title={t('timer.step3')} disabled={readOnly}>
          <div className="look-grid" role="radiogroup" aria-label={t('timer.step3')}>
            {TIMER_STYLES.map((look) => (
              <button
                key={look}
                type="button"
                role="radio"
                aria-checked={draft.style === look}
                className={`look-card look-card--timer ${draft.style === look ? 'is-active' : ''}`}
                onClick={() => set('style', look)}
              >
                <span className="look-thumb">
                  <TimerView {...viewProps} leftMs={draft.startMinutes * 60_000} running look={look} showRules={false} adds={[]} test={false} />
                </span>
                <b>{t(`timer.look.${look}` as StringKey)}</b>
              </button>
            ))}
          </div>
          <label className="field">
            <span>{t('lb.titleOnStream')}</span>
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={40} />
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
          <label className="switch">
            <input type="checkbox" checked={draft.showAdds} onChange={(e) => set('showAdds', e.target.checked)} />
            <span>{t('timer.showAdds')}</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={draft.showRules} onChange={(e) => set('showRules', e.target.checked)} />
            <span>{t('timer.showRules')}</span>
          </label>
          <details className="disclosure">
            <summary>{t('common.advanced')}</summary>
            <label className="field">
              <span className="field-row">
                <span>{t('lb.gap')}</span>
                <output>{t('lb.hours', { n: draft.sessionGapHours })}</output>
              </span>
              <input
                type="range"
                min={TIMER_LIMITS.sessionGapHours.min}
                max={TIMER_LIMITS.sessionGapHours.max}
                value={draft.sessionGapHours}
                onChange={(e) => set('sessionGapHours', Number(e.target.value))}
              />
              <span className="muted small">{t('timer.gapHint')}</span>
            </label>
            <p className="muted small">{t('timer.controlsHint', { setup: '&setup=1' })}</p>
          </details>
        </StepCard>

        <section className="card">
          <div className="card-row">
            <h2 className="card-title">📁 {t('timer.saved')}</h2>
            <a className="btn btn--small" href="#/timers" onClick={() => id === null && setDraft(freshTimer(t))}>
              ＋ {t('common.new')}
            </a>
          </div>
          {mine.length ? (
            <ul className="config-list">
              {mine.map((c) => (
                <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                  <a href={`#/timers/${c.id}`}>
                    <span className="gift-icon">⏱️</span>
                    <span className="config-name">{c.name}</span>
                    <span className="muted small">
                      {c.startMinutes < 60 ? t('timer.minutes', { n: c.startMinutes }) : t('timer.hours', { n: Math.round((c.startMinutes / 60) * 10) / 10 })}
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
          <div className="side-preview side-preview--timer">
            <div className="timer-preview-frame">
              <TimerView {...viewProps} leftMs={timeLeft(preview, now)} running={preview.running} look={draft.style} adds={draft.showAdds ? adds : []} test />
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => testAdd(giftSeconds(draft.rules, { repeatCount: 5, diamondCount: 1 }), 'sara.live', '🌹')}>
              {t('timer.testGift')}
            </button>
            <button type="button" className="btn" onClick={() => testAdd(draft.rules.perFollow, 'omar_99', '👥')}>
              {t('timer.testFollow')}
            </button>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setPreview((p) => (p.running ? pause(p, Date.now()) : resume(p, Date.now())))}>
              {preview.running ? `⏸ ${t('timer.pause')}` : `▶ ${t('timer.resume')}`}
            </button>
            <button type="button" className="btn" onClick={() => setPreview(createTimer(draft.startMinutes * 60_000, Date.now(), true))}>
              ↺ {t('common.reset')}
            </button>
            <button type="button" className="btn" onClick={() => setPreview(createTimer(5_000, Date.now(), true))}>
              {t('timer.testEnd')}
            </button>
          </div>
          <p className="muted small">{t('timer.previewHint')}</p>
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

        <LinkCard url={url} storageUrl={storageUrl} dirty={!!saved && dirty} size={t('timer.size')} />
        <ConnectionCard configId={saved?.id ?? null} />
      </aside>
    </div>
  );
}
