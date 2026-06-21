import { useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { handoffToEstimate } from '../../lib/estimateHandoff';
import { getQuickPickServiceTypes } from '../../lib/estimateData';
import { type EstimateSearchSource, trackTicketRemove } from '../../lib/analytics';
import {
  RecentLookup,
  SubscribedTicket,
  removeRecentLookup,
  unsubscribeFromTicket,
} from '../../lib/homePreferences';
import { DataManifest } from '../../api/dataTypes';
import LookupShortcutRow from '../shared/LookupShortcutRow';
import RequestTypeSearchField from '../shared/RequestTypeSearchField';
import {
  SURFACE_CARD_BODY_CLASS,
  SURFACE_CARD_CLASS,
  SURFACE_CARD_HEADER_CLASS,
} from '../shared/surfaceStyles';

interface HomeReturnVisitProps {
  manifest: DataManifest;
  recentLookups: RecentLookup[];
  savedTickets: SubscribedTicket[];
  defaultWard: string | null;
}

export default function HomeReturnVisit({
  manifest,
  recentLookups,
  savedTickets,
  defaultWard,
}: HomeReturnVisitProps) {
  const { setActiveTab } = useDashboard();
  const quickPicks = getQuickPickServiceTypes(manifest, 4);

  const handleServiceTypeSelect = useCallback((serviceType: string, _source: EstimateSearchSource) => {
    handoffToEstimate(
      { serviceType, ward: defaultWard ?? null },
      setActiveTab,
      'home_quick_pick',
    );
  }, [defaultWard, setActiveTab]);

  const handleTicketSubmit = useCallback((ticketId: string) => {
    handoffToEstimate({ ticket: ticketId }, setActiveTab, 'home_ticket');
  }, [setActiveTab]);

  const handleRemoveRecent = useCallback((id: string) => {
    removeRecentLookup(id);
  }, []);

  const handleRemoveSaved = useCallback((ticketId: string) => {
    unsubscribeFromTicket(ticketId);
    trackTicketRemove('home');
  }, []);

  const hasShortcuts = savedTickets.length > 0
    || recentLookups.length > 0
    || quickPicks.length > 0;

  return (
    <div className={SURFACE_CARD_CLASS}>
      <div className={SURFACE_CARD_HEADER_CLASS}>
        <p className="text-body font-medium text-gray-900 mb-0">Check a request</p>
      </div>
      <div className={SURFACE_CARD_BODY_CLASS}>
        <RequestTypeSearchField
          serviceTypes={manifest.dictionaries.serviceTypes}
          categoryMap={manifest.categoryMap}
          inputId="home-return-request-search"
          onServiceTypeSelect={handleServiceTypeSelect}
          onTicketSubmit={handleTicketSubmit}
        />

        {hasShortcuts && (
          <div className="mt-3">
            <LookupShortcutRow
              savedTickets={savedTickets}
              recentLookups={recentLookups}
              quickPicks={quickPicks}
              defaultWard={defaultWard}
              onRemoveRecent={handleRemoveRecent}
              onRemoveSaved={handleRemoveSaved}
            />
          </div>
        )}
      </div>
    </div>
  );
}
