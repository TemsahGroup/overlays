import { useEffect, useState, type CSSProperties } from 'react';
import { getBuilderEffect } from '../builder/effects';
import { giftIcon } from '../builder/gifts';
import { repository } from '../builder/repository/localRepository';
import type { OverlayConfig } from '../builder/types';
import { OVERLAY_TYPES } from '../catalog/overlayTypes';
import { chatRepository } from '../chat/repository';
import type { ChatConfig } from '../chat/types';
import { leaderboardRepository } from '../leaderboard/repository';
import type { LeaderboardConfig } from '../leaderboard/types';
import { AppShell } from '../ui/AppShell';
import { useI18n } from '../ui/i18n';
import type { StringKey } from '../ui/strings';

interface SavedItem {
  key: string;
  href: string;
  icon: string;
  name: string;
  detail: string;
  paused: boolean;
  updatedAt: string;
}

export function HomePage() {
  const { t } = useI18n();
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([repository.listMine(), leaderboardRepository.listMine(), chatRepository.listMine()]).then(([gifts, boards, chats]: [OverlayConfig[], LeaderboardConfig[], ChatConfig[]]) => {
      if (cancelled) return;
      const list: SavedItem[] = [
        ...gifts.map((c) => ({
          key: `g-${c.id}`,
          href: `#/builder/${c.id}`,
          icon: giftIcon(c.mappings[0].selectedGiftName),
          name: c.name,
          detail: `${c.mappings[0].selectedGiftName} → ${t(`effect.${getBuilderEffect(c.mappings[0].effectId).id}` as StringKey)}`,
          paused: !c.enabled,
          updatedAt: c.updatedAt,
        })),
        ...boards.map((c) => ({
          key: `l-${c.id}`,
          href: `#/leaderboards/${c.id}`,
          icon: c.kind === 'likers' ? '❤️' : '🏆',
          name: c.name,
          detail: `${c.kind === 'likers' ? t('lb.likers') : t('lb.gifters')} · ${t('lb.rowsValue', { n: c.topN })}`,
          paused: !c.enabled,
          updatedAt: c.updatedAt,
        })),
        ...chats.map((c) => ({
          key: `c-${c.id}`,
          href: `#/chats/${c.id}`,
          icon: '💬',
          name: c.name,
          detail: t(`chat.look.${c.style}` as StringKey),
          paused: !c.enabled,
          updatedAt: c.updatedAt,
        })),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <AppShell active="home" title={t('nav.home')}>
      <main className="home">
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <h1>{t('home.title')}</h1>
          <p>{t('home.subtitle')}</p>
          <div className="hero-actions">
            <a className="btn primary btn--big" href="#/builder">
              🎁 {t('home.start')}
            </a>
            <a className="btn btn--big" href="#/leaderboards">
              🏆 {t('nav.leaderboards')}
            </a>
          </div>
          <p className="muted small">ℹ️ {t('home.requirement')}</p>
        </section>

        <section className="home-section">
          <h2>{t('home.how')}</h2>
          <ol className="how">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="card">
                <span className="how-n">{n}</span>
                <b>{t(`home.how${n}.title` as StringKey)}</b>
                <span className="muted">{t(`home.how${n}.text` as StringKey)}</span>
              </li>
            ))}
          </ol>
        </section>

        {items.length > 0 && (
          <section className="home-section">
            <h2>{t('home.mine')}</h2>
            <ul className="saved-grid">
              {items.map((i) => (
                <li key={i.key}>
                  <a className="card saved-card" href={i.href}>
                    <span className="saved-icon">{i.icon}</span>
                    <span className="saved-text">
                      <b>{i.name}</b>
                      <span className="muted small">{i.detail}</span>
                    </span>
                    {i.paused && <span className="chip chip--mock">⏸</span>}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="home-section">
          <h2>{t('home.library')}</h2>
          <p className="muted">{t('home.libraryHint')}</p>
          <ul className="type-grid">
            {OVERLAY_TYPES.map((type) => (
              <li key={type.id}>
                {type.href ? (
                  <a className="card type-card" href={type.href} style={{ '--type-accent': type.accent } as CSSProperties}>
                    <span className="type-icon">{type.icon}</span>
                    <b>{t(type.title)}</b>
                    <span className="muted small">{t(type.description)}</span>
                    <span className="type-cta">{t('home.open')} →</span>
                  </a>
                ) : (
                  <div className="card type-card is-soon" style={{ '--type-accent': type.accent } as CSSProperties} aria-disabled="true">
                    <span className="type-icon">{type.icon}</span>
                    <b>{t(type.title)}</b>
                    <span className="muted small">{t(type.description)}</span>
                    <span className="chip">{t('home.soon')}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <footer className="home-foot">
          <a href="./?lab=1" className="muted small">
            🧪 {t('home.lab')}
          </a>
        </footer>
      </main>
    </AppShell>
  );
}
