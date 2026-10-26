import { useCallback, useEffect, useState } from 'react';
import { LIVE_STATUS_LABEL, NotRunningHelp } from '../../builder/components/LiveStatusPanel';
import { encodeJson } from '../../builder/repository/portable';
import { OwnershipError } from '../../builder/repository/types';
import { leaderboardUrl } from '../../builder/route';
import { newId } from '../../builder/validate';
import { STATUS_STALE_MS, subscribeStatus, type StatusMessage } from '../../integrations/tikfinity/eventApi/statusChannel';
import { leaderboardRepository } from '../repository';
import { createSession, rank, scoreMode, type LeaderboardSession } from '../store';
import type { LeaderboardConfig, LeaderboardKind } from '../types';
import { KIND_DEFAULTS, LB_LIMITS, newLeaderboard, toPublicLeaderboard } from '../validate';
import { DEMO_VIEWERS, feedDemo, testGift, testLikes } from './demo';
import { LeaderboardView } from './LeaderboardView';

type Status = { kind: 'info' | 'error' | 'ok'; text: string } | null;
const sameContent = (a: LeaderboardConfig | null, b: LeaderboardConfig) =>
  !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Live status reported by an overlay tab of this browser (read-only). */
function useReportedStatus(configId: string | null) {
  const [latest, setLatest] = useState<{ msg: StatusMessage; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setLatest(null);
    return subscribeStatus((msg) => {
      if (msg.configId === configId) setLatest({ msg, at: Date.now() });
    });
  }, [configId]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);
  return latest && now - latest.at < STATUS_STALE_MS ? latest.msg : null;
}

export function LeaderboardBuilderPage({ id }: { id: string | null }) {
  const [draft, setDraft] = useState<LeaderboardConfig>(() => newLeaderboard(leaderboardRepository.currentOwnerId()));
  const [saved, setSaved] = useState<LeaderboardConfig | null>(null);
  const [mine, setMine] = useState<LeaderboardConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [copied, setCopied] = useState(false);
  // Preview data is TEST data in memory only — never the live session.
  const [preview, setPreview] = useState<LeaderboardSession>(() => createSession(Date.now()));

  const refreshList = useCallback(() => leaderboardRepository.listMine().then(setMine), []);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Leaderboards · Gift Overlay Builder';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        setDraft(newLeaderboard(leaderboardRepository.currentOwnerId()));
        setSaved(null);
        return;
      }
      const found = await leaderboardRepository.get(id);
      if (cancelled) return;
      if (!found) {
        setStatus({ kind: 'error', text: 'Leaderboard not found in this browser’s storage.' });
        return;
      }
      setDraft(found);
      setSaved(found);
      if (found.ownerId !== leaderboardRepository.currentOwnerId()) {
        setReadOnly(true);
        setStatus({ kind: 'info', text: 'This leaderboard belongs to another owner. Duplicate it to make your own copy.' });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
  }, [id, refreshList]);

  const reported = useReportedStatus(saved?.id ?? null);
  const liveStatus = reported?.state.status ?? 'disconnected';
  const dirty = !sameContent(saved, draft);

  const setKind = (kind: LeaderboardKind) => {
    const d = KIND_DEFAULTS[kind];
    setDraft((c) => ({ ...c, kind, title: d.title, name: c.name === KIND_DEFAULTS[c.kind].title ? d.title : c.name, colors: [...d.colors] as [string, string] }));
    setPreview(createSession(Date.now()));
  };

  const save = async () => {
    try {
      const record = await leaderboardRepository.save(draft);
      setDraft(record);
      setSaved(record);
      setStatus({ kind: 'ok', text: 'Saved.' });
      refreshList();
      if (id !== record.id) window.location.hash = `#/leaderboards/${record.id}`;
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof OwnershipError ? e.message : 'Could not save (storage unavailable?).' });
    }
  };

  const duplicate = () => {
    const now = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: leaderboardRepository.currentOwnerId(), name: `${draft.name} (copy)`, createdAt: now, updatedAt: now, enabled: true });
    setSaved(null);
    setReadOnly(false);
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await leaderboardRepository.save({ ...saved, enabled: !saved.enabled });
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(`Delete “${saved.name}”?`)) return;
    await leaderboardRepository.remove(saved.id);
    window.location.hash = '#/leaderboards';
    refreshList();
  };

  const url = saved ? leaderboardUrl(saved.id, encodeJson(toPublicLeaderboard(saved))) : null;
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt('Copy this URL:', url);
    }
  };

  const now = () => Date.now();

  return (
    <div className="dashboard builder">
      <aside className="panel">
        <header className="panel-header">
          <div>
            <h1>Leaderboards</h1>
            <p className="sub">
              <a href="#/builder">🎁 Gift effects</a> · <b>🏆 Leaderboards</b> · <a href="./">LIVE Overlay Effects ↗</a>
            </p>
          </div>
          <span className="chip chip--mock" title={leaderboardRepository.label}>LOCAL</span>
        </header>

        {status && <p className={`notice notice--${status.kind}`}>{status.text}</p>}

        <fieldset className="section" disabled={readOnly}>
          <h2>1 · Type</h2>
          <div className="seg seg--inline">
            {(['gifters', 'likers'] as LeaderboardKind[]).map((k) => (
              <button key={k} type="button" className={draft.kind === k ? 'is-active' : ''} onClick={() => setKind(k)}>
                {k === 'gifters' ? '🏆 Top Gifters' : '❤️ Top Likers'}
              </button>
            ))}
          </div>
          <p className="hint">
            {draft.kind === 'gifters'
              ? 'Ranked by coin value (TikFinity diamondCount × count). If a gift arrives without a value, the board ranks by number of gifts instead.'
              : 'Ranked by likes. Totals are approximate: TikTok does not send every like event on busy streams.'}
          </p>
        </fieldset>

        <fieldset className="section" disabled={readOnly}>
          <h2>2 · Look</h2>
          <div className="field-pair">
            <label className="field">
              <span>Name (for you)</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} />
            </label>
            <label className="field">
              <span>Title on stream</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={40} />
            </label>
          </div>
          <label className="field">
            <span className="field-row">
              <span>Rows shown</span>
              <output>Top {draft.topN}</output>
            </span>
            <input type="range" min={LB_LIMITS.topN.min} max={LB_LIMITS.topN.max} value={draft.topN} onChange={(e) => setDraft({ ...draft, topN: Number(e.target.value) })} />
          </label>
          <div className="field">
            <span>Colors</span>
            <div className="colors">
              {draft.colors.map((c, i) => (
                <span key={i} className="color">
                  <input
                    type="color"
                    value={c}
                    aria-label={i === 0 ? 'Accent color' : 'Second color'}
                    onChange={(e) => setDraft({ ...draft, colors: (i === 0 ? [e.target.value, draft.colors[1]] : [draft.colors[0], e.target.value]) as [string, string] })}
                  />
                </span>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-row">
              <span>New stream after a break of</span>
              <output>{draft.sessionGapHours} h</output>
            </span>
            <input
              type="range"
              min={LB_LIMITS.sessionGapHours.min}
              max={LB_LIMITS.sessionGapHours.max}
              value={draft.sessionGapHours}
              onChange={(e) => setDraft({ ...draft, sessionGapHours: Number(e.target.value) })}
            />
            <span className="hint">The board starts empty when no gift/like arrived for this long (TikFinity has no “stream started” event).</span>
          </label>
        </fieldset>

        <section className="section">
          <h2>3 · Preview with test data</h2>
          <div className="row">
            {draft.kind === 'gifters' ? (
              <>
                <button type="button" className="btn" onClick={() => setPreview((s) => testGift(s, pick(DEMO_VIEWERS), 1, now()))}>
                  + small gift (1)
                </button>
                <button type="button" className="btn" onClick={() => setPreview((s) => testGift(s, pick(DEMO_VIEWERS), 99, now()))}>
                  + big gift (99)
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setPreview((s) => testLikes(s, pick(DEMO_VIEWERS), 15, now()))}>
                + 15 likes
              </button>
            )}
          </div>
          <div className="row">
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                setPreview((s) => {
                  let next = s;
                  for (let i = 0; i < 12; i++) next = feedDemo(next, draft.kind, now() + i);
                  return next;
                })
              }
            >
              ▶ Fill with test data
            </button>
            <button type="button" className="btn" onClick={() => setPreview(createSession(now()))}>
              Clear
            </button>
          </div>
          <p className="hint">Preview data is TEST data and stays in this page only. It never reaches a live leaderboard.</p>
        </section>

        <section className="section">
          <h2>4 · Save & overlay URL</h2>
          {readOnly ? (
            <button type="button" className="btn primary" onClick={duplicate}>
              Duplicate as my leaderboard
            </button>
          ) : (
            <div className="row">
              <button type="button" className="btn primary" onClick={save} disabled={!dirty && !!saved}>
                {saved ? (dirty ? '💾 Save changes' : '✓ Saved') : '💾 Save leaderboard'}
              </button>
              {saved && (
                <button type="button" className="btn" onClick={toggleEnabled}>
                  {saved.enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            </div>
          )}
          {saved && dirty && <p className="notice notice--info">Unsaved changes — the link below still uses the last saved version.</p>}
          {url ? (
            <div className="url-row">
              <span className="hint">
                <b>OBS link</b> — add it as its own Browser Source (e.g. 500 × 700). Copy again after each save.
              </span>
              <code>{url}</code>
              <div className="row">
                <button type="button" className="btn" onClick={copy}>
                  {copied ? '✓ Copied' : 'Copy overlay URL'}
                </button>
                <a className="btn" href={`${url}&demo=1`} target="_blank" rel="noreferrer">
                  Open with test data ↗
                </a>
              </div>
            </div>
          ) : (
            <p className="hint">Save the leaderboard to get its OBS link.</p>
          )}
          {saved && !readOnly && (
            <button type="button" className="btn btn--danger" onClick={remove}>
              Delete leaderboard
            </button>
          )}
        </section>

        <section className="section">
          <h2>My leaderboards</h2>
          <ul className="config-list">
            {mine.map((c) => (
              <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                <a href={`#/leaderboards/${c.id}`}>
                  <span className="gift-icon">{c.kind === 'likers' ? '❤️' : '🏆'}</span>
                  <span className="config-name">{c.name}</span>
                  <span className="hint">
                    {c.kind === 'likers' ? 'Top Likers' : 'Top Gifters'} · top {c.topN}
                    {!c.enabled && ' · disabled'}
                  </span>
                </a>
              </li>
            ))}
            {!mine.length && <li className="hint">No saved leaderboards yet.</li>}
          </ul>
          <a className="btn" href="#/leaderboards" onClick={() => id === null && setDraft(newLeaderboard(leaderboardRepository.currentOwnerId()))}>
            ＋ New leaderboard
          </a>
        </section>

        <section className="section">
          <h2>OBS setup</h2>
          <ol className="steps">
            <li>Save, then copy the overlay URL.</li>
            <li>
              OBS → Sources → <b>+</b> → <b>Browser</b>, paste the URL, size about <b>500 × 700</b>, and place it where you like.
            </li>
            <li>
              Add <code>&amp;setup=1</code> to see the TikFinity status, the scoring mode and a <b>Reset</b> button (click it with OBS
              “Interact”). Remove it before streaming.
            </li>
            <li>
              Add <code>&amp;demo=1</code> to check the layout with TEST data (no live connection in that mode).
            </li>
            <li>The board keeps its scores if OBS reloads, and starts empty after the break set above.</li>
          </ol>
        </section>

        <section className="section">
          <h2>TikFinity connection</h2>
          <div className={`conn conn--${liveStatus}`}>
            <span className="conn-dot" />
            <b>{LIVE_STATUS_LABEL[liveStatus]}</b>
            <span className={`chip ${reported?.state.verifiedGiftAt ? 'chip--tikfinity' : 'chip--mock'}`}>
              {reported?.state.verifiedGiftAt ? 'LIVE GIFTS VERIFIED' : 'NOT VERIFIED LIVE'}
            </span>
          </div>
          <p className="hint">
            {reported
              ? reported.state.detail
              : 'No overlay of this leaderboard is open in this browser. The live connection runs only inside the overlay (OBS), with TikFinity Desktop on the same computer.'}
          </p>
          {reported && (liveStatus === 'error' || liveStatus === 'disconnected') && <NotRunningHelp />}
        </section>
      </aside>

      <main className="preview">
        <div className="preview-bar">
          <span className="hint">Preview · TEST data · {draft.kind === 'gifters' ? `ranking by ${scoreMode(preview) === 'coins' ? 'coin value' : 'gift count'}` : 'ranking by likes'}</span>
        </div>
        <div className="preview-area">
          <div className="lb-preview-frame">
            <LeaderboardView
              title={draft.title}
              kind={draft.kind}
              rows={rank(preview, draft.kind, draft.topN)}
              mode={scoreMode(preview)}
              colors={draft.colors}
              topN={draft.topN}
              test
            />
          </div>
        </div>
      </main>
    </div>
  );
}
