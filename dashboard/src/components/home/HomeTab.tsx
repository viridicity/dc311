import { useEffect, useMemo, useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { buildTicketIndex, normalizeTicketId } from '../../lib/estimateData';
import { backfillRecentTicketServiceTypes } from '../../lib/homePreferences';
import { trackMethodologiesLinkClick, trackHomeTabView } from '../../lib/analytics';
import { slaCategorySummary } from '../../lib/dataProcessing';
import { computeOverviewHeadline, computeMonthlySlaSummary, computeMonthlyThroughput } from '../../lib/overviewAnalytics';
import { mergeRollups, mergeSlaRollups } from '../../lib/rollups';
import { useRecentLookups, useDefaultWard, useSavedLocation, useSubscribedTickets } from '../../hooks/useLocalPrefs';
import { useTimelineRollups } from '../../hooks/useTimelineRollups';
import SlaComplianceSummary from '../overview/SlaComplianceSummary';
import SlaComplianceSummarySkeleton from '../overview/SlaComplianceSummarySkeleton';
import ExploreVolumeSummary from './ExploreVolumeSummary';
import ExploreVolumeSummarySkeleton from './ExploreVolumeSummarySkeleton';
import HomeFirstVisit from './HomeFirstVisit';
import HomeReturnVisit from './HomeReturnVisit';
import { METHODOLOGIES_TAB_ID } from '../../lib/site';

interface HomeTabProps {
  isActive?: boolean;
}

export default function HomeTab({ isActive = true }: HomeTabProps) {
  const { data, manifest, setActiveTab } = useDashboard();
  const { timelineRollups, isLoading: timelineLoading } = useTimelineRollups();
  const recentLookups = useRecentLookups();
  const [defaultWard] = useDefaultWard();
  const savedLocation = useSavedLocation();
  const subscribedTickets = useSubscribedTickets();

  const ticketIndex = useMemo(
    () => (data?.rows?.length ? buildTicketIndex(data.rows) : null),
    [data?.rows],
  );

  useEffect(() => {
    if (!ticketIndex) return;
    backfillRecentTicketServiceTypes((ticketId) => {
      const normalized = normalizeTicketId(ticketId);
      const row = ticketIndex.get(normalized) ?? ticketIndex.get(ticketId.trim());
      return row?.SERVICECODEDESCRIPTION ?? null;
    });
  }, [ticketIndex]);

  const layoutMode = recentLookups.length > 0 ? 'return' : 'first';

  useEffect(() => {
    trackHomeTabView(layoutMode);
  }, [layoutMode]);

  const headline = useMemo(
    () => (timelineRollups?.length ? computeOverviewHeadline(timelineRollups) : null),
    [timelineRollups],
  );

  const monthly = useMemo(
    () => (timelineRollups ? computeMonthlySlaSummary(timelineRollups) : []),
    [timelineRollups],
  );

  const throughput = useMemo(
    () => (timelineRollups ? computeMonthlyThroughput(timelineRollups) : []),
    [timelineRollups],
  );

  const dicts = data?.manifest.dictionaries || manifest?.dictionaries;

  const categoryBreakdown = useMemo(() => {
    if (!timelineRollups?.length || !dicts) return [];
    return mergeRollups(timelineRollups, dicts).categoryBreakdown;
  }, [timelineRollups, dicts]);

  const categoriesBelow95Count = useMemo(() => {
    if (!timelineRollups?.length || !dicts) return 0;
    const slaRows = mergeSlaRollups(timelineRollups, dicts);
    return slaCategorySummary(slaRows).filter((row) => row.pct_met_sla < 95).length;
  }, [timelineRollups, dicts]);

  const totalCategoryCount = useMemo(() => {
    if (!timelineRollups?.length || !dicts) return 0;
    return slaCategorySummary(mergeSlaRollups(timelineRollups, dicts)).length;
  }, [timelineRollups, dicts]);

  const handleMethodologiesClick = useCallback(() => {
    trackMethodologiesLinkClick('home');
    setActiveTab(METHODOLOGIES_TAB_ID);
  }, [setActiveTab]);

  return (
    <div className="w-full">
      {layoutMode === 'return' ? (
        <HomeReturnVisit
          manifest={manifest!}
          recentLookups={recentLookups}
          savedTickets={subscribedTickets}
          defaultWard={defaultWard}
        />
      ) : (
        <HomeFirstVisit
          manifest={manifest!}
          savedTickets={subscribedTickets}
          defaultWard={defaultWard}
        />
      )}

      {timelineLoading || !headline ? (
        <SlaComplianceSummarySkeleton />
      ) : (
        <SlaComplianceSummary
          pctMetSla={headline.pctMetSla}
          failures={headline.failures}
          errorBudgetAt99={headline.errorBudgetAt99}
          months={monthly}
          categoriesBelow95Count={categoriesBelow95Count}
          totalCategoryCount={totalCategoryCount}
          onReliabilityClick={() => setActiveTab('sla')}
          onMethodologiesClick={handleMethodologiesClick}
        />
      )}

      {timelineLoading || !headline || !data ? (
        <ExploreVolumeSummarySkeleton />
      ) : (
        <ExploreVolumeSummary
          headline={headline}
          throughput={throughput}
          categoryBreakdown={categoryBreakdown}
          rows={data.rows}
          showRequestFlowMap
          mapIsActive={isActive}
          savedLocation={savedLocation}
          onExploreClick={() => setActiveTab('explorer')}
        />
      )}

    </div>
  );
}
