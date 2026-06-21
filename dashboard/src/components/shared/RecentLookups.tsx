import { useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { handoffToEstimate } from '../../lib/estimateHandoff';
import {
  RecentLookup,
  removeRecentLookup,
  clearRecentLookups,
} from '../../lib/homePreferences';
import { trackHomeReturnClick } from '../../lib/analytics';
import RecentLookupChip from './RecentLookupChip';
import { SURFACE_CARD_HEADER_CLASS } from './surfaceStyles';

interface RecentLookupsProps {
  lookups: RecentLookup[];
  onLookupsChange: () => void;
  heading?: string | null;
  showNewLookup?: boolean;
}

export default function RecentLookups({
  lookups,
  onLookupsChange,
  heading = 'Pick up where you left off',
  showNewLookup = true,
}: RecentLookupsProps) {
  const { setActiveTab } = useDashboard();

  const resumeLookup = useCallback((lookup: RecentLookup) => {
    trackHomeReturnClick();
    handoffToEstimate(
      {
        ticket: lookup.ticket ?? null,
        serviceType: lookup.serviceType ?? null,
        ward: lookup.ward ?? null,
        waitDays: lookup.waitDays ?? null,
      },
      setActiveTab,
      'recent_lookup',
    );
  }, [setActiveTab]);

  const handleNewLookup = useCallback(() => {
    handoffToEstimate({}, setActiveTab, 'home_cta');
  }, [setActiveTab]);

  const handleRemove = useCallback((id: string) => {
    removeRecentLookup(id);
    onLookupsChange();
  }, [onLookupsChange]);

  const handleClearAll = useCallback(() => {
    clearRecentLookups();
    onLookupsChange();
  }, [onLookupsChange]);

  if (lookups.length === 0) {
    return null;
  }

  return (
    <section className="border border-border rounded-lg mb-2 overflow-hidden">
      {heading && (
        <div className={`${SURFACE_CARD_HEADER_CLASS} bg-surface`}>
          <h3 className="text-body font-medium text-gray-900 mb-0">{heading}</h3>
        </div>
      )}
      <div className={`${heading ? 'px-4 py-2' : 'px-4 py-3'} bg-gray-50`}>
        <div className="flex flex-wrap gap-2">
          {lookups.map((lookup) => (
            <RecentLookupChip
              key={lookup.id}
              lookup={lookup}
              onSelect={resumeLookup}
              onRemove={handleRemove}
            />
          ))}
        </div>
        {(showNewLookup || lookups.length > 1) && (
          <div className="flex flex-wrap gap-3 mt-2">
            {showNewLookup && (
              <button
                type="button"
                onClick={handleNewLookup}
                className="text-caption text-text-muted hover:text-gray-900 transition-colors"
              >
                + New lookup
              </button>
            )}
            {lookups.length > 1 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-caption text-text-muted hover:text-gray-900 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
