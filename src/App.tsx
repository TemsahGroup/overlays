import { useEffect, useMemo } from 'react';
import { parseRoute } from './config/route';
import { createMockAdapter } from './events/adapters/mockAdapter';
import { startTabRelay } from './events/relay';
import { dispatchExternalEvent } from './integrations/tikfinity';
import { Dashboard } from './components/Dashboard';
import { OverlayStage } from './components/OverlayStage';
import { useHashRoute } from './builder/route';
import { BuilderPage } from './builder/components/BuilderPage';
import { BuilderOverlayPage } from './builder/components/BuilderOverlayPage';
import { LeaderboardBuilderPage } from './leaderboard/components/LeaderboardBuilderPage';
import { LeaderboardOverlayPage } from './leaderboard/components/LeaderboardOverlayPage';
import { ChatBuilderPage } from './chat/components/ChatBuilderPage';
import { ChatOverlayPage } from './chat/components/ChatOverlayPage';
import { GoalBuilderPage } from './goal/components/GoalBuilderPage';
import { GoalOverlayPage } from './goal/components/GoalOverlayPage';
import { HomePage } from './home/HomePage';
import { TimerBuilderPage } from './timer/components/TimerBuilderPage';
import { TimerOverlayPage } from './timer/components/TimerOverlayPage';
import { WheelBuilderPage } from './wheel/components/WheelBuilderPage';
import { WheelOverlayPage } from './wheel/components/WheelOverlayPage';
import { I18nProvider } from './ui/i18n';

export default function App() {
  const route = useMemo(() => parseRoute(), []);
  // Gift Overlay Builder lives on hash routes (#/builder, #/overlay/:id);
  // without a hash the original LIVE Overlay Effects app renders unchanged.
  const builderRoute = useHashRoute();

  useEffect(() => {
    if (builderRoute) return; // builder pages manage this class themselves
    document.documentElement.classList.toggle('is-overlay', route.overlay);
  }, [route.overlay, builderRoute]);

  // Mirror events between tabs of this browser (dashboard → overlay tab).
  useEffect(() => startTabRelay(), []);

  // Overlay-only extras: random mock events and the one-shot URL trigger.
  useEffect(() => {
    if (!route.overlay || builderRoute) return;
    const adapter = route.demo ? createMockAdapter() : null;
    adapter?.connect();
    const t = route.trigger ? setTimeout(() => dispatchExternalEvent(route.trigger!, 'url'), 400) : null;
    return () => {
      adapter?.disconnect();
      if (t) clearTimeout(t);
    };
  }, [route, builderRoute]);

  // Streamer-facing pages share the language switch; OBS overlays never do.
  const hasQuery = window.location.search.length > 1;
  if (builderRoute?.page === 'home' || (!builderRoute && !hasQuery)) {
    return (
      <I18nProvider>
        <HomePage />
      </I18nProvider>
    );
  }
  if (builderRoute?.page === 'builder' || builderRoute?.page === 'leaderboards') {
    return (
      <I18nProvider>
        {builderRoute.page === 'builder' ? <BuilderPage id={builderRoute.id} /> : <LeaderboardBuilderPage id={builderRoute.id} />}
      </I18nProvider>
    );
  }
  if (builderRoute?.page === 'timers') {
    return (
      <I18nProvider>
        <TimerBuilderPage id={builderRoute.id} />
      </I18nProvider>
    );
  }
  if (builderRoute?.page === 'timer') {
    const { page: _page, ...flags } = builderRoute;
    return <TimerOverlayPage {...flags} />;
  }
  if (builderRoute?.page === 'wheels') {
    return (
      <I18nProvider>
        <WheelBuilderPage id={builderRoute.id} />
      </I18nProvider>
    );
  }
  if (builderRoute?.page === 'wheel') {
    const { page: _page, ...flags } = builderRoute;
    return <WheelOverlayPage {...flags} />;
  }
  if (builderRoute?.page === 'goals') {
    return (
      <I18nProvider>
        <GoalBuilderPage id={builderRoute.id} />
      </I18nProvider>
    );
  }
  if (builderRoute?.page === 'goal') {
    const { page: _page, ...flags } = builderRoute;
    return <GoalOverlayPage {...flags} />;
  }
  if (builderRoute?.page === 'chats') {
    return (
      <I18nProvider>
        <ChatBuilderPage id={builderRoute.id} />
      </I18nProvider>
    );
  }
  if (builderRoute?.page === 'chat') {
    const { page: _page, ...flags } = builderRoute;
    return <ChatOverlayPage {...flags} />;
  }
  if (builderRoute?.page === 'leaderboard') {
    const { page: _page, ...flags } = builderRoute;
    return <LeaderboardOverlayPage {...flags} />;
  }
  if (builderRoute?.page === 'overlay') {
    return <BuilderOverlayPage {...builderRoute} />;
  }

  if (route.overlay) {
    return (
      <OverlayStage
        effects={route.effects}
        settings={route.settings}
        snow={route.snow}
        snowSettings={route.snowSettings}
        testBadge={route.testBadge}
      />
    );
  }

  const params = new URLSearchParams(window.location.search);
  // ?lab=1 opens this developer dashboard (the home page now lives at "/").
  const settingsFromUrl = [...params.keys()].some((k) => k !== 'snow' && k !== 'demo' && k !== 'lab');
  return (
    <Dashboard
      initialSettings={route.settings}
      settingsFromUrl={settingsFromUrl}
      initialSnow={route.snow}
      snowSettings={route.snowSettings}
      initialDemo={route.demo}
    />
  );
}
