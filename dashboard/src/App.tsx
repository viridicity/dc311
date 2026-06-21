import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDashboardData, fetchManifest } from './api/data';
import { DateRangePreset } from './api/dataTypes';
import AboutPanel from './components/shell/AboutPanel';
import AppFooter from './components/shell/AppFooter';
import AppHeader from './components/shell/AppHeader';
import ProfilePanel from './components/shell/ProfilePanel';
import TabNav from './components/shell/TabNav';
import { DashboardProvider } from './context/DashboardContext';
import { trackAboutOpen, trackMethodologiesLinkClick, trackEvent, trackProfileOpen } from './lib/analytics';
import { ESTIMATE_URL_KEYS, resolveTabFromSearchParams, stripEstimateSearchParams } from './lib/estimateRouting';
import { METHODOLOGIES_TAB_ID, TabId } from './lib/site';
import HomeTab from './components/home/HomeTab';
import EstimateTab from './components/estimate/EstimateTab';
import SLATab from './components/sla/SLATab';
import ExplorerTab from './components/explorer/ExplorerTab';

const MethodologiesTab = lazy(() => import('./components/overview/MethodologiesTab'));
const RawDataTab = lazy(() => import('./components/raw/RawDataTab'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 24 * 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function TabFallback() {
  return (
    <div className="p-4">
      <div className="bg-surface border border-border rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  );
}

function readInitialTab(): TabId {
  return resolveTabFromSearchParams(new window.URLSearchParams(window.location.search));
}

function DashboardShell() {
  const [activeTab, setActiveTab] = useState<TabId>(readInitialTab);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('full');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number; currentShard: string } | null>(null);
  const tabHistoryMode = useRef<'replace' | 'push'>('replace');

  const handleTabChange = useCallback((tab: TabId) => {
    tabHistoryMode.current = 'push';
    setActiveTab((current) => {
      if (current === tab) {
        return current;
      }
      trackEvent('tab_view', { tab });
      return tab;
    });
  }, []);

  useEffect(() => {
    trackEvent('tab_view', { tab: readInitialTab() });
  }, []);


  useEffect(() => {
    const onPopState = () => {
      tabHistoryMode.current = 'replace';
      const tab = readInitialTab();
      setActiveTab(tab);
      trackEvent('tab_view', { tab });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const params = new window.URLSearchParams(window.location.search);

    if (activeTab === 'home' || activeTab === 'methodologies') {
      const hasEstimateState = ESTIMATE_URL_KEYS.some((key) => params.has(key));
      if (hasEstimateState) {
        if (params.get('tab') === activeTab) return;
        params.set('tab', activeTab);
        const url = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, '', url);
        return;
      }
      if (activeTab === 'home') {
        const url = window.location.pathname;
        if (window.location.search) {
          window.history.replaceState(null, '', url);
        }
        return;
      }
      if (activeTab === 'methodologies') {
        params.set('tab', METHODOLOGIES_TAB_ID);
        const next = `${window.location.pathname}?${params.toString()}`;
        const current = `${window.location.pathname}${window.location.search}`;
        if (current !== next) {
          const writeUrl = tabHistoryMode.current === 'push'
            ? window.history.pushState.bind(window.history)
            : window.history.replaceState.bind(window.history);
          writeUrl(null, '', next);
          tabHistoryMode.current = 'push';
        }
        return;
      }
    }

    if (activeTab !== 'estimate') {
      stripEstimateSearchParams(params);
    }

    params.set('tab', activeTab);

    const next = `${window.location.pathname}?${params.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === next) return;

    const writeUrl = tabHistoryMode.current === 'push'
      ? window.history.pushState.bind(window.history)
      : window.history.replaceState.bind(window.history);
    writeUrl(null, '', next);
    tabHistoryMode.current = 'push';
  }, [activeTab]);

  const handleDatePresetChange = useCallback((preset: DateRangePreset) => {
    setDatePreset((current) => {
      if (current === preset) {
        return current;
      }
      trackEvent('date_range_change', { preset });
      return preset;
    });
  }, []);

  const { data: manifest, error: manifestError } = useQuery({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['dashboardData', datePreset],
    queryFn: () => fetchDashboardData(datePreset, setLoadProgress),
    enabled: !!manifest,
  });

  useEffect(() => {
    if (!error && !manifestError) {
      return;
    }
    const err = error || manifestError;
    if (err) {
      trackEvent('data_load_error', {
        message: (err as Error).message.slice(0, 100),
      });
    }
  }, [error, manifestError]);

  const handleAboutOpen = useCallback(() => {
    setAboutOpen(true);
    trackAboutOpen();
  }, []);

  const handleProfileOpen = useCallback(() => {
    setProfileOpen(true);
    trackProfileOpen();
  }, []);

  const handleMethodologiesOpen = useCallback((source: 'about' | 'footer') => {
    trackMethodologiesLinkClick(source);
    setAboutOpen(false);
    handleTabChange(METHODOLOGIES_TAB_ID);
  }, [handleTabChange]);

  const isLoadingRows = activeTab === 'raw' && (isLoading || isFetching);

  const builtAt = (data?.manifest.builtAt || manifest?.builtAt)
    ? new Date((data?.manifest.builtAt || manifest?.builtAt)!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Home and Methodologies always use the full-year timeline; reflect that in the header label.
  const dateLabel = datePreset === '90d' && activeTab !== 'methodologies' && activeTab !== 'home'
    ? 'Last 90 days'
    : 'Full year';
  const rowCount = data?.rows.length ?? 0;

  const dashboardValue = useMemo(
    () => ({
      data,
      manifest,
      isLoading,
      isLoadingRows,
      error: (error || manifestError) as Error | null,
      datePreset,
      setDatePreset: handleDatePresetChange,
      loadProgress,
      activeTab,
      setActiveTab: handleTabChange,
      openProfile: handleProfileOpen,
    }),
    [data, manifest, isLoading, isLoadingRows, error, manifestError, datePreset, loadProgress, activeTab, handleDatePresetChange, handleTabChange, handleProfileOpen],
  );

  if (error || manifestError) {
    const err = (error || manifestError) as Error;
    return (
      <div className="min-h-screen bg-surface-muted p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Error loading data</h3>
            <p className="text-red-600 text-sm">{err.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardProvider value={dashboardValue}>
      <div className="min-h-screen bg-surface-muted flex flex-col">
        <AppHeader
          builtAt={builtAt}
          rowCount={rowCount}
          dateLabel={dateLabel}
          isLoading={isLoading}
          loadProgress={loadProgress}
          onProfileClick={handleProfileOpen}
        />

        <TabNav activeTab={activeTab} onTabChange={handleTabChange} />

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-3">
          {!manifest ? (
            <div className="p-4 flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span className="text-sm text-text-muted">Loading dashboard data…</span>
            </div>
          ) : (
            <Suspense fallback={<TabFallback />}>
              <div className={activeTab === 'home' ? undefined : 'hidden'} aria-hidden={activeTab !== 'home'}>
                <HomeTab isActive={activeTab === 'home'} />
              </div>
              {activeTab === 'methodologies' && <MethodologiesTab />}
              {activeTab === 'estimate' && <EstimateTab />}
              {activeTab === 'sla' && <SLATab />}
              {activeTab === 'explorer' && <ExplorerTab />}
              {activeTab === 'raw' && <RawDataTab />}
            </Suspense>
          )}
        </main>

        <AppFooter
          onAboutClick={handleAboutOpen}
          onMethodologiesClick={() => handleMethodologiesOpen('footer')}
        />

        <AboutPanel
          open={aboutOpen}
          builtAt={builtAt}
          onClose={() => setAboutOpen(false)}
          onMethodologiesClick={() => handleMethodologiesOpen('about')}
        />

        <ProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
        />
      </div>
    </DashboardProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell />
    </QueryClientProvider>
  );
}

export default App;
