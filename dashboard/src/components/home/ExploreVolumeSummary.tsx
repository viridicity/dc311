import { Ref, useMemo } from 'react';
import { SavedLocation } from '../../lib/homePreferences';
import { OverviewHeadline } from '../../lib/overviewAnalytics';
import { ProcessedRequest } from '../../lib/dataProcessing';
import { monthlyThroughputChart } from '../../lib/charts';
import {
  capChartHeight,
  chartTitle,
  legendBelow,
  pieMargin,
} from '../../lib/responsiveChartLayout';
import { CATEGORICAL_COLORS } from '../../lib/theme';
import { useIsDesktop, useIsMobile } from '../../hooks/useBreakpoint';
import DeferredChart from '../shared/DeferredChart';
import ArticleFigure from '../overview/ArticleFigure';
import HomeRequestFlowMap from './HomeRequestFlowMap';

const CAT_PALETTE = [...CATEGORICAL_COLORS];

export interface CategoryBreakdownRow {
  category: string;
  resolved: number;
  open: number;
  total: number;
}

interface ExploreVolumeSummaryProps {
  headline: OverviewHeadline;
  throughput: Array<{ label: string; filed: number; resolved: number }>;
  categoryBreakdown: CategoryBreakdownRow[];
  rows?: ProcessedRequest[];
  showRequestFlowMap?: boolean;
  /** When false, pauses map playback while the Home tab stays mounted off-screen. */
  mapIsActive?: boolean;
  savedLocation?: SavedLocation | null;
  onExploreClick?: () => void;
  sectionRef?: Ref<HTMLElement>;
}

export default function ExploreVolumeSummary({
  headline,
  throughput,
  categoryBreakdown,
  rows,
  showRequestFlowMap = false,
  mapIsActive = true,
  savedLocation = null,
  onExploreClick,
  sectionRef,
}: ExploreVolumeSummaryProps) {
  const isBentoWide = useIsDesktop();
  const isMobile = useIsMobile();

  const throughputChart = useMemo(
    () => monthlyThroughputChart(throughput),
    [throughput],
  );

  const throughputHeight = capChartHeight(360, !isBentoWide);

  const throughputLayout: Record<string, unknown> = {
    height: throughputHeight,
    margin: { t: 56, b: 80, l: 56, r: 24 },
    title: chartTitle('Requests filed and resolved by month'),
    barmode: 'overlay',
    xaxis: { title: '', tickangle: -45 },
    yaxis: { title: 'Requests', tickformat: ',' },
    legend: legendBelow(true),
  };

  const categoryPieData = useMemo(() => [
    {
      labels: categoryBreakdown.map((c) => c.category),
      values: categoryBreakdown.map((c) => c.resolved + c.open),
      type: 'pie' as const,
      textinfo: isMobile ? 'percent' as const : 'label+percent' as const,
      textposition: 'inside' as const,
      hole: 0.3,
      name: 'Share',
      hovertemplate: '<b>%{label}</b><br>%{value:,} requests<br>%{percent}<extra></extra>',
      showlegend: false,
      marker: {
        colors: categoryBreakdown.map((_, i) => CAT_PALETTE[i % CAT_PALETTE.length]),
      },
    },
  ], [categoryBreakdown, isMobile]);

  const categoryPieLayout: Record<string, unknown> = {
    height: isMobile ? 280 : 360,
    margin: pieMargin(),
    title: chartTitle('Share of total'),
  };

  return (
    <section ref={sectionRef} className="article-section article-prose">
      <h2 className="article-headline">The weight of half a million requests</h2>
      <p className="article-dek">
        {headline.total.toLocaleString()} requests filed in twelve months.{' '}
        {headline.open.toLocaleString()} still open.
        {onExploreClick && (
          <>
            {' '}
            <button
              type="button"
              onClick={onExploreClick}
              className="article-link"
            >
              Explore charts, maps, and filters
            </button>
          </>
        )}
      </p>

      {showRequestFlowMap && rows && rows.length > 0 && (
        <HomeRequestFlowMap rows={rows} isActive={mapIsActive} savedLocation={savedLocation} />
      )}

      <DeferredChart minHeight={300}>
        <div className="grid lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-8 min-w-0">
            <ArticleFigure
              caption="Requests filed (bars) and resolved (line) per month. The gap between them is the backlog accumulating or clearing."
              data={throughputChart.traces}
              layout={throughputLayout}
            />
          </div>
          {categoryBreakdown.length > 0 && (
            <div className="lg:col-span-4 min-w-0">
              <ArticleFigure
                caption="Share of requests by category."
                data={categoryPieData}
                layout={categoryPieLayout}
              />
            </div>
          )}
        </div>
      </DeferredChart>
    </section>
  );
}
