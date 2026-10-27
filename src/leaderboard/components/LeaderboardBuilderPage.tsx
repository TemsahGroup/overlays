import { useCallback, useEffect, useState } from 'react';
import { encodeJson } from '../../builder/repository/portable';
import { OwnershipError } from '../../builder/repository/types';
import { leaderboardUrl } from '../../builder/route';
import { newId } from '../../builder/validate';
import { AppShell, Notice, PageHead, StepCard, useToast } from '../../ui/AppShell';
import { useI18n, type Translate } from '../../ui/i18n';
import { ConnectionCard, LinkCard } from '../../ui/LinkCard';
import { leaderboardRepository } from '../repository';
import { createSession, rank, scoreMode, type LeaderboardSession } from '../store';
import type { LeaderboardConfig, LeaderboardKind } from '../types';
import { KIND_DEFAULTS, LB_LIMITS, newLeaderboard, toPublicLeaderboard } from '../validate';
import { DEMO_VIEWERS, feedDemo, testGift, testLikes } from './demo';
import { LeaderboardView } from './LeaderboardView';

const sameContent = (a: LeaderboardConfig | null, b: LeaderboardConfig) =>
  !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

const defaultTitle = (t: Translate, kind: LeaderboardKind) => (kind === 'likers' ? t('lb.defaultLikers') : t('lb.defaultGifters'));
/** Titles that were never edited by the user (any language) follow the kind. */
const isDefaultTitle = (title: string) => ['Top Gifters', 'Top Likers', 'أكتر الداعمين', 'أكتر اللايكات'].includes(title);

function freshBoard(t: Translate, kind: LeaderboardKind = 'gifters'): LeaderboardConfig {
  const board = newLeaderboard(leaderboardRepository.currentOwnerId(), kind);
  return { ...board, name: defaultTitle(t, kind), title: defaultTitle(t, kind) };
}

export function LeaderboardBuilderPage({ id }: { id: string | null }) {
  const { t } = useI18n();
  return (
    <AppShell active="leaderboards" title={t('lb.title')}>
      <LeaderboardWorkspace id={id} />
    </AppShell>
  );
}

function LeaderboardWorkspace({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<LeaderboardConfig>(() => freshBoard(t));
  const [saved, setSaved] = useState<LeaderboardConfig | null>(null);
  const [mine, setMine] = useState<LeaderboardConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  // Preview data is TEST data in memory only — never the live session.
  const [preview, setPreview] = useState<LeaderboardSession>(() => {
    let s = createSession(Date.now());
    for (let i = 0; i < 10; i++) s = feedDemo(s, 'gifters', Date.now() + i);
    return s;
  });

  const refreshList = useCallback(() => leaderboardRepository.listMine().then(setMine), []);

  useEffect(() => {
    let cancelled = false;
    setNotice(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        setDraft(freshBoard(t));
        setSaved(null);
        return;
      }
      const found = await leaderboardRepository.get(id);
      if (cancelled) return;
      if (!found) {
        setNotice({ kind: 'error', text: t('common.notFound') });
        return;
      }
      setDraft(found);
      setSaved(found);
      if (found.ownerId !== leaderboardRepository.currentOwnerId()) {
        setReadOnly(true);
        setNotice({ kind: 'info', text: t('common.readOnly') });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
    // t only provides defaults for a brand-new board; switching language must not reset edits.
  }, [id, refreshList]);

  // A brand-new board whose title was never edited follows the UI language.
  useEffect(() => {
    if (saved) return;
    setDraft((d) => ({
      ...d,
      title: isDefaultTitle(d.title) ? defaultTitle(t, d.kind) : d.title,
      name: isDefaultTitle(d.name) ? defaultTitle(t, d.kind) : d.name,
    }));
  }, [t, saved]);

  const dirty = !sameContent(saved, draft);
  const now = () => Date.now();

  const fill = (kind: LeaderboardKind) => {
    let s = createSession(now());
    for (let i = 0; i < 12; i++) s = feedDemo(s, kind, now() + i);
    setPreview(s);
  };

  const setKind = (kind: LeaderboardKind) => {
    const d = KIND_DEFAULTS[kind];
    setDraft((c) => ({
      ...c,
      kind,
      title: isDefaultTitle(c.title) ? defaultTitle(t, kind) : c.title,
      name: isDefaultTitle(c.name) ? defaultTitle(t, kind) : c.name,
      colors: [...d.colors] as [string, string],
    }));
    fill(kind);
  };

  const save = async () => {
    try {
      const record = await leaderboardRepository.save(draft);
      setDraft(record);
      setSaved(record);
      setNotice(null);
      toast(t('common.savedToast'));
      refreshList();
      if (id !== record.id) window.location.hash = `#/leaderboards/${record.id}`;
    } catch (e) {
      toast(e instanceof OwnershipError ? t('common.ownerError') : t('common.saveError'), 'error');
    }
  };

  const duplicate = () => {
    const ts = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: leaderboardRepository.currentOwnerId(), name: `${draft.name} (2)`, createdAt: ts, updatedAt: ts, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setNotice({ kind: 'info', text: t('common.copyCreated') });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await leaderboardRepository.save({ ...saved, enabled: !saved.enabled });
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('lb.confirmDelete', { name: saved.name }))) return;
    await leaderboardRepository.remove(saved.id);
    window.location.hash = '#/leaderboards';
    refreshList();
  };

  const url = saved ? leaderboardUrl(saved.id, encodeJson(toPublicLeaderboard(saved)), lang) : null;
  const storageUrl = saved ? leaderboardUrl(saved.id, undefined, lang) : null;

  return (
    <div className="workspace">
      <div className="editor">
        <PageHead icon="🏆" title={t('lb.title')} subtitle={t('lb.subtitle')} />

        <label className="name-field">
          <span>{t('common.name')}</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} disabled={readOnly} />
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <StepCard n={1} title={t('lb.step1')} disabled={readOnly}>
          <div className="choice-grid">
            {(['gifters', 'likers'] as LeaderboardKind[]).map((k) => (
              <button key={k} type="button" className={`choice ${draft.kind === k ? 'is-active' : ''}`} onClick={() => setKind(k)} aria-pressed={draft.kind === k}>
                <span className="choice-icon">{k === 'gifters' ? '🏆' : '❤️'}</span>
                <b>{k === 'gifters' ? t('lb.gifters') : t('lb.likers')}</b>
                <span className="muted small">{k === 'gifters' ? t('lb.gifters.hint') : t('lb.likers.hint')}</span>
              </button>
            ))}
          </div>
        </StepCard>

        <StepCard n={2} title={t('lb.step2')} disabled={readOnly}>
          <label className="field">
            <span>{t('lb.titleOnStream')}</span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={40} />
          </label>
          <label className="field">
            <span className="field-row">
              <span>{t('lb.rows')}</span>
              <output>{t('lb.rowsValue', { n: draft.topN })}</output>
            </span>
            <input type="range" min={LB_LIMITS.topN.min} max={LB_LIMITS.topN.max} value={draft.topN} onChange={(e) => setDraft({ ...draft, topN: Number(e.target.value) })} />
          </label>
          <div className="field-pair">
            {([0, 1] as const).map((i) => (
              <label key={i} className="field field--color">
                <span>{i === 0 ? t('lb.accent') : t('lb.accent2')}</span>
                <input
                  type="color"
                  value={draft.colors[i]}
                  onChange={(e) => setDraft({ ...draft, colors: (i === 0 ? [e.target.value, draft.colors[1]] : [draft.colors[0], e.target.value]) as [string, string] })}
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
                min={LB_LIMITS.sessionGapHours.min}
                max={LB_LIMITS.sessionGapHours.max}
                value={draft.sessionGapHours}
                onChange={(e) => setDraft({ ...draft, sessionGapHours: Number(e.target.value) })}
              />
              <span className="muted small">{t('lb.gapHint')}</span>
            </label>
            <p className="muted small">{t('lb.resetHint', { setup: '&setup=1' })}</p>
          </details>
        </StepCard>

        <section className="card">
          <div className="card-row">
            <h2 className="card-title">📁 {t('lb.saved')}</h2>
            <a className="btn btn--small" href="#/leaderboards" onClick={() => id === null && setDraft(freshBoard(t))}>
              ＋ {t('common.new')}
            </a>
          </div>
          {mine.length ? (
            <ul className="config-list">
              {mine.map((c) => (
                <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                  <a href={`#/leaderboards/${c.id}`}>
                    <span className="gift-icon">{c.kind === 'likers' ? '❤️' : '🏆'}</span>
                    <span className="config-name">{c.name}</span>
                    <span className="muted small">
                      {c.kind === 'likers' ? t('lb.likers') : t('lb.gifters')} · {t('lb.rowsValue', { n: c.topN })}
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
          <div className="side-preview side-preview--board">
            <div className="lb-preview-frame">
              <LeaderboardView
                title={draft.title}
                kind={draft.kind}
                rows={rank(preview, draft.kind, draft.topN)}
                mode={scoreMode(preview)}
                colors={draft.colors}
                topN={draft.topN}
                test
                lang={lang}
              />
            </div>
          </div>
          <div className="row">
            {draft.kind === 'gifters' ? (
              <>
                <button type="button" className="btn" onClick={() => setPreview((s) => testGift(s, pick(DEMO_VIEWERS), 1, now()))}>
                  {t('lb.addSmall')}
                </button>
                <button type="button" className="btn" onClick={() => setPreview((s) => testGift(s, pick(DEMO_VIEWERS), 99, now()))}>
                  {t('lb.addBig')}
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setPreview((s) => testLikes(s, pick(DEMO_VIEWERS), 15, now()))}>
                {t('lb.addLikes')}
              </button>
            )}
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => fill(draft.kind)}>
              ▶ {t('lb.fill')}
            </button>
            <button type="button" className="btn" onClick={() => setPreview(createSession(now()))}>
              {t('lb.clear')}
            </button>
          </div>
          <p className="muted small">{t('lb.previewHint')}</p>
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

        <LinkCard url={url} storageUrl={storageUrl} dirty={!!saved && dirty} size={t('lb.size')} />
        <ConnectionCard configId={saved?.id ?? null} />
      </aside>
    </div>
  );
}
