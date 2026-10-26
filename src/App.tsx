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

  if (builderRoute?.page === 'builder') return <BuilderPage id={builderRoute.id} />;
  if (builderRoute?.page === 'leaderboards') return <LeaderboardBuilderPage id={builderRoute.id} />;
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
  const settingsFromUrl = [...params.keys()].some((k) => k !== 'snow' && k !== 'demo');
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
