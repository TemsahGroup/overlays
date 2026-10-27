import { useCallback, useEffect, useState } from 'react';
import { encodeJson } from '../../builder/repository/portable';
import { OwnershipError } from '../../builder/repository/types';
import { chatUrl } from '../../builder/route';
import { newId } from '../../builder/validate';
import { AppShell, Notice, PageHead, StepCard, useToast } from '../../ui/AppShell';
import { useI18n, type Translate } from '../../ui/i18n';
import { ConnectionCard, LinkCard } from '../../ui/LinkCard';
import type { StringKey } from '../../ui/strings';
import { chatRepository } from '../repository';
import { pushMessage, type ChatMessage } from '../store';
import { CHAT_STYLES, type ChatConfig } from '../types';
import { CHAT_LIMITS, cleanWords, newChat, toPublicChat } from '../validate';
import { ChatView } from './ChatView';
import { demoMessage } from './demo';

const sameContent = (a: ChatConfig | null, b: ChatConfig) => !!a && JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' });

/** Fixed sample messages for the style picker thumbnails. */
const SAMPLE: ChatMessage[] = [
  { id: 's1', kind: 'chat', userKey: 'sara.live', name: 'sara.live', text: 'السلام عليكم 👋', at: 0, test: false },
  { id: 's2', kind: 'gift', userKey: 'omar_99', name: 'omar_99', text: '', gift: { name: 'Rose', count: 5 }, at: 0, test: false },
  { id: 's3', kind: 'chat', userKey: 'lina.art', name: 'lina.art', text: 'gg 🔥', at: 0, test: false, subscriber: true },
];

const defaultName = (t: Translate) => t('chat.defaultName');
const isDefaultName = (name: string) => ['Live chat', 'شات البث'].includes(name);

function freshChat(t: Translate): ChatConfig {
  return { ...newChat(chatRepository.currentOwnerId()), name: defaultName(t) };
}

const wordsText = (words: string[]) => words.join('، ');
const parseWords = (text: string) => cleanWords(text.split(/[,،\n]/));

export function ChatBuilderPage({ id }: { id: string | null }) {
  const { t } = useI18n();
  return (
    <AppShell active="chat" title={t('chat.title')}>
      <ChatWorkspace id={id} />
    </AppShell>
  );
}

function ChatWorkspace({ id }: { id: string | null }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<ChatConfig>(() => freshChat(t));
  const [saved, setSaved] = useState<ChatConfig | null>(null);
  const [mine, setMine] = useState<ChatConfig[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [blockedText, setBlockedText] = useState('');
  // Preview messages are TEST data on this page only.
  const [preview, setPreview] = useState<ChatMessage[]>(() => Array.from({ length: 5 }, (_, i) => demoMessage(Date.now() - (5 - i) * 1000)));
  const [auto, setAuto] = useState(true);

  const refreshList = useCallback(() => chatRepository.listMine().then(setMine), []);

  useEffect(() => {
    let cancelled = false;
    setNotice(null);
    setReadOnly(false);
    (async () => {
      if (!id) {
        const fresh = freshChat(t);
        setDraft(fresh);
        setBlockedText('');
        setSaved(null);
        return;
      }
      const found = await chatRepository.get(id);
      if (cancelled) return;
      if (!found) {
        setNotice({ kind: 'error', text: t('common.notFound') });
        return;
      }
      setDraft(found);
      setSaved(found);
      setBlockedText(wordsText(found.blockedWords));
      if (found.ownerId !== chatRepository.currentOwnerId()) {
        setReadOnly(true);
        setNotice({ kind: 'info', text: t('common.readOnly') });
      }
    })();
    refreshList();
    return () => {
      cancelled = true;
    };
    // t only provides defaults for a brand-new chat; switching language must not reset edits.
  }, [id, refreshList]);

  // A brand-new chat whose name was never edited follows the UI language.
  useEffect(() => {
    if (!saved) setDraft((d) => (isDefaultName(d.name) ? { ...d, name: defaultName(t) } : d));
  }, [t, saved]);

  const max = draft.maxMessages;
  const addPreview = useCallback((msg: ChatMessage) => setPreview((list) => pushMessage(list, msg, max)), [max]);

  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => addPreview(demoMessage(Date.now(), draft.showGifts ? 0.15 : 0)), 1800);
    return () => clearInterval(timer);
  }, [auto, addPreview, draft.showGifts]);

  const set = <K extends keyof ChatConfig>(key: K, value: ChatConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = !sameContent(saved, draft);

  const save = async () => {
    try {
      const record = await chatRepository.save(draft);
      setDraft(record);
      setSaved(record);
      setNotice(null);
      toast(t('common.savedToast'));
      refreshList();
      if (id !== record.id) window.location.hash = `#/chats/${record.id}`;
    } catch (e) {
      toast(e instanceof OwnershipError ? t('common.ownerError') : t('common.saveError'), 'error');
    }
  };

  const duplicate = () => {
    const ts = new Date().toISOString();
    setDraft({ ...draft, id: newId(), ownerId: chatRepository.currentOwnerId(), name: `${draft.name} (2)`, createdAt: ts, updatedAt: ts, enabled: true });
    setSaved(null);
    setReadOnly(false);
    setNotice({ kind: 'info', text: t('common.copyCreated') });
  };

  const toggleEnabled = async () => {
    if (!saved) return;
    const record = await chatRepository.save({ ...saved, enabled: !saved.enabled });
    setDraft(record);
    setSaved(record);
    refreshList();
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('chat.confirmDelete', { name: saved.name }))) return;
    await chatRepository.remove(saved.id);
    window.location.hash = '#/chats';
    refreshList();
  };

  const url = saved ? chatUrl(saved.id, encodeJson(toPublicChat(saved)), lang) : null;
  const storageUrl = saved ? chatUrl(saved.id, undefined, lang) : null;
  const viewProps = { colors: draft.colors, textScale: draft.textScale, showAvatars: draft.showAvatars, lang };

  return (
    <div className="workspace">
      <div className="editor">
        <PageHead icon="💬" title={t('chat.title')} subtitle={t('chat.subtitle')} />

        <label className="name-field">
          <span>{t('common.name')}</span>
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={60} disabled={readOnly} />
        </label>

        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <StepCard n={1} title={t('chat.step1')} disabled={readOnly}>
          <div className="look-grid" role="radiogroup" aria-label={t('chat.step1')}>
            {CHAT_STYLES.map((look) => (
              <button
                key={look}
                type="button"
                role="radio"
                aria-checked={draft.style === look}
                className={`look-card look-card--chat look-card--chat-${look} ${draft.style === look ? 'is-active' : ''}`}
                onClick={() => set('style', look)}
              >
                <span className="look-thumb">
                  <ChatView messages={SAMPLE} look={look} fadeSeconds={0} test={false} {...viewProps} textScale={100} />
                </span>
                <b>{t(`chat.look.${look}` as StringKey)}</b>
              </button>
            ))}
          </div>
        </StepCard>

        <StepCard n={2} title={t('chat.step2')} disabled={readOnly}>
          <label className="field">
            <span className="field-row">
              <span>{t('chat.max')}</span>
              <output>{draft.maxMessages}</output>
            </span>
            <input type="range" min={CHAT_LIMITS.maxMessages.min} max={CHAT_LIMITS.maxMessages.max} value={draft.maxMessages} onChange={(e) => set('maxMessages', Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="field-row">
              <span>{t('chat.fade')}</span>
              <output>{draft.fadeSeconds ? t('chat.seconds', { n: draft.fadeSeconds }) : t('chat.never')}</output>
            </span>
            <input type="range" min={0} max={120} step={5} value={draft.fadeSeconds} onChange={(e) => set('fadeSeconds', Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="field-row">
              <span>{t('chat.size')}</span>
              <output>{draft.textScale}%</output>
            </span>
            <input type="range" min={CHAT_LIMITS.textScale.min} max={CHAT_LIMITS.textScale.max} step={10} value={draft.textScale} onChange={(e) => set('textScale', Number(e.target.value))} />
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
            <input type="checkbox" checked={draft.showAvatars} onChange={(e) => set('showAvatars', e.target.checked)} />
            <span>{t('chat.avatars')}</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={draft.showGifts} onChange={(e) => set('showGifts', e.target.checked)} />
            <span>{t('chat.gifts')}</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={draft.hideCommands} onChange={(e) => set('hideCommands', e.target.checked)} />
            <span>{t('chat.commands')}</span>
          </label>
          <label className="field">
            <span>{t('chat.blocked')}</span>
            <textarea
              value={blockedText}
              rows={2}
              placeholder={t('chat.blockedPlaceholder')}
              onChange={(e) => {
                setBlockedText(e.target.value);
                set('blockedWords', parseWords(e.target.value));
              }}
            />
            <span className="muted small">{t('chat.blockedHint', { n: draft.blockedWords.length })}</span>
          </label>
        </StepCard>

        <section className="card">
          <div className="card-row">
            <h2 className="card-title">📁 {t('chat.saved')}</h2>
            <a className="btn btn--small" href="#/chats" onClick={() => id === null && setDraft(freshChat(t))}>
              ＋ {t('common.new')}
            </a>
          </div>
          {mine.length ? (
            <ul className="config-list">
              {mine.map((c) => (
                <li key={c.id} className={c.id === draft.id ? 'is-active' : ''}>
                  <a href={`#/chats/${c.id}`}>
                    <span className="gift-icon">💬</span>
                    <span className="config-name">{c.name}</span>
                    <span className="muted small">
                      {t(`chat.look.${c.style}` as StringKey)}
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
          <div className="side-preview side-preview--chat">
            <div className={`chat-preview-frame chat-preview-frame--${draft.style}`}>
              <ChatView messages={preview} look={draft.style} fadeSeconds={draft.fadeSeconds} test {...viewProps} />
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => addPreview(demoMessage(Date.now(), 0))}>
              {t('chat.addMessage')}
            </button>
            <button type="button" className="btn" onClick={() => addPreview(demoMessage(Date.now(), 1))}>
              {t('chat.addGift')}
            </button>
          </div>
          <div className="row">
            <button type="button" className={`btn ${auto ? '' : 'primary'}`} onClick={() => setAuto((a) => !a)}>
              {auto ? `⏸ ${t('chat.autoStop')}` : `▶ ${t('chat.autoStart')}`}
            </button>
            <button type="button" className="btn" onClick={() => setPreview([])}>
              {t('lb.clear')}
            </button>
          </div>
          <p className="muted small">{t('chat.previewHint')}</p>
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

        <LinkCard url={url} storageUrl={storageUrl} dirty={!!saved && dirty} size={t(draft.style === 'ticker' ? 'chat.sizeTicker' : 'chat.sizeHint')} />
        <ConnectionCard configId={saved?.id ?? null} />
      </aside>
    </div>
  );
}
