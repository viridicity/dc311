import { useQuery } from '@tanstack/react-query';
import { fetchRollupTimeline } from '../api/data';
import { RollupFile } from '../api/dataTypes';
import { useDashboard } from '../context/DashboardContext';

/** Full-year monthly rollups for Home and Methodologies — no row hydration. */
export function useTimelineRollups(): {
  timelineRollups: RollupFile[] | undefined;
  isLoading: boolean;
} {
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboard();
  const allShardCount = dashboardData?.manifest.shards.length ?? 0;
  const hasFullTimeline = (dashboardData?.monthlyRollups.length ?? 0) >= allShardCount;

  const { data: fetchedTimeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['rollupTimeline'],
    queryFn: fetchRollupTimeline,
    enabled: !hasFullTimeline && Boolean(dashboardData?.manifest),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const timelineRollups = hasFullTimeline
    ? dashboardData?.monthlyRollups
    : fetchedTimeline;

  return {
    timelineRollups,
    isLoading: dashboardLoading || (!hasFullTimeline && timelineLoading),
  };
}
