import { useCallback, useEffect, useState } from 'react';
import { LiveStatusPanel } from '../../builder/components/LiveStatusPanel';
import { decodeJson } from '../../builder/repository/portable';
import type { OverlayFlags } from '../../builder/route';
import { createStatusPublisher, STATUS_HEARTBEAT_MS } from '../../integrations/tikfinity/eventApi/statusChannel';
import {
  DEFAULT_EVENT_API_URL,
  TikFinityEventApiAdapter,
  type LiveState,
} from '../../integrations/tikfinity/eventApi/TikFinityEventApiAdapter';
import { chatRepository } from '../repository';
import { isAllowed, pushMessage, type ChatMessage } from '../store';
import type { PublicChatConfig } from '../types';
import { sanitizePublicChat } from '../validate';
import { ChatView } from './ChatView';
import { demoMessage } from './demo';

type Load = { state: 'loading' } | { state: 'ready'; config: PublicChatConfig } | { state: 'missing'; reason: string };

/**
 * OBS chat overlay: transparent, display-only. Messages come straight from
 * its own TikFinity connection and live in memory only — nothing viewers
 * write is stored. Demo mode (?demo=1) shows clearly-labelled TEST messages.
 */
export function ChatOverlayPage({ id, portable, demo, live, setup, diag, eventApiUrl, lang }: OverlayFlags) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [adapter, setAdapter] = useState<TikFinityEventApiAdapter | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('is-overlay');
    return () => document.documentElement.classList.remove('is-overlay');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = portable ? decodeJson(portable, sanitizePublicChat) : await chatRepository.getPublic(id);
      if (cancelled) return;
      if (config && config.id === id) setLoad({ state: 'ready', config });
      else setLoad({ state: 'missing', reason: portable ? 'Invalid chat link' : 'Chat overlay not found in this browser. Use the portable link from the editor.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, portable]);

  const config = load.state === 'ready' ? load.config : null;
  const max = config?.maxMessages ?? 8;
  const add = useCallback((msg: ChatMessage) => setMessages((list) => pushMessage(list, msg, max)), [max]);

  // Live TikFinity connection (not in demo mode, so test and live messages never mix).
  const enabled = config?.enabled ?? false;
  const showGifts = config?.showGifts ?? false;
  const hideCommands = config?.hideCommands ?? true;
  const blocked = config?.blockedWords.join('\n') ?? '';
  useEffect(() => {
    if (!live || demo || !enabled) return;
    const filter = { hideCommands, blockedWords: blocked ? blocked.split('\n') : [] };
    const a = new TikFinityEventApiAdapter({ url: eventApiUrl ?? DEFAULT_EVENT_API_URL });
    const status = createStatusPublisher(id);
    const unsubscribe = a.subscribe((s) => {
      setLiveState(s);
      status.publish(s);
    });
    a.connect(
      (gift) => {
        if (!showGifts || gift.provider !== 'tikfinity' || gift.isTest) return;
        const now = Date.now();
        add({
          id: gift.eventId ? `g-${gift.eventId}` : `g-${now}-${Math.random()}`,
          kind: 'gift',
          userKey: gift.username.toLowerCase(),
          name: gift.nickname || gift.username,
          text: '',
          gift: { name: gift.giftName, count: gift.repeatCount },
          at: now,
          test: false,
        });
      },
      {
        onChat: (chat) => {
          if (chat.provider !== 'tikfinity' || chat.isTest || !isAllowed(chat.comment, filter)) return;
          const now = Date.now();
          add({
            id: chat.eventId ? `c-${chat.eventId}` : `c-${now}-${Math.random()}`,
            kind: 'chat',
            userKey: chat.username.toLowerCase(),
            name: chat.nickname || chat.username,
            text: chat.comment,
            avatarUrl: chat.avatarUrl,
            moderator: chat.isModerator,
            subscriber: chat.isSubscriber,
            at: now,
            test: false,
          });
        },
      },
    );
    setAdapter(a);
    const heartbeat = setInterval(() => status.publish(a.liveState), STATUS_HEARTBEAT_MS);
    const onHide = () => status.publish({ ...a.liveState, status: 'disconnected', detail: 'Overlay page closed.' });
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onHide);
      unsubscribe();
      a.disconnect();
      status.publish(a.liveState);
      status.close();
      setAdapter(null);
    };
  }, [live, demo, enabled, showGifts, hideCommands, blocked, eventApiUrl, id, add]);

  // Layout check: TEST messages in memory only.
  useEffect(() => {
    if (!demo || !config) return;
    const t = setInterval(() => add(demoMessage(Date.now(), config.showGifts ? 0.15 : 0)), 1800);
    return () => clearInterval(t);
  }, [demo, config, add]);

  if (!config) {
    return load.state === 'missing' ? <div className="overlay-notice">⚠️ {load.reason}</div> : null;
  }

  return (
    <>
      {config.enabled ? (
        <ChatView
          messages={messages}
          look={config.style}
          colors={config.colors}
          textScale={config.textScale}
          showAvatars={config.showAvatars}
          fadeSeconds={config.fadeSeconds}
          test={demo}
          lang={lang ?? 'en'}
        />
      ) : (
        <div className="overlay-notice">This chat overlay has been disabled by its owner.</div>
      )}
      {setup && (
        <LiveStatusPanel
          live={live && !demo}
          state={liveState}
          adapter={adapter}
          diag={diag}
          extra={
            <div className="lb-setup">
              <p className="hint">
                Chat messages are shown only — never stored. On screen: {messages.length} / {config.maxMessages}. Hidden: {config.hideCommands ? '!commands, ' : ''}
                {config.blockedWords.length} blocked word(s).
              </p>
              <button type="button" className="btn" onClick={() => setMessages([])}>
                Clear chat now
              </button>
            </div>
          }
        />
      )}
    </>
  );
}
