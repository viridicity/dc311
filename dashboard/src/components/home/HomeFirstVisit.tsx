import { useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { handoffToEstimate } from '../../lib/estimateHandoff';
import { getQuickPickServiceTypes } from '../../lib/estimateData';
import { type EstimateSearchSource, trackTicketRemove } from '../../lib/analytics';
import { SubscribedTicket, unsubscribeFromTicket } from '../../lib/homePreferences';
import { DataManifest } from '../../api/dataTypes';
import LookupShortcutRow from '../shared/LookupShortcutRow';
import RequestTypeSearchField from '../shared/RequestTypeSearchField';
import {
  SURFACE_CARD_BODY_CLASS,
  SURFACE_CARD_CLASS,
  SURFACE_CARD_HEADER_CLASS,
} from '../shared/surfaceStyles';

interface HomeFirstVisitProps {
  manifest: DataManifest;
  savedTickets: SubscribedTicket[];
  defaultWard?: string | null;
}

export default function HomeFirstVisit({
  manifest,
  savedTickets,
  defaultWard = null,
}: HomeFirstVisitProps) {
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

  const handleRemoveSaved = useCallback((ticketId: string) => {
    unsubscribeFromTicket(ticketId);
    trackTicketRemove('home');
  }, []);

  return (
    <div className={SURFACE_CARD_CLASS}>
      <div className={SURFACE_CARD_HEADER_CLASS}>
        <p className="text-body font-medium text-gray-900 mb-0">
          How long will your 311 request take?
        </p>
      </div>
      <div className={SURFACE_CARD_BODY_CLASS}>
        <RequestTypeSearchField
          serviceTypes={manifest.dictionaries.serviceTypes}
          categoryMap={manifest.categoryMap}
          inputId="home-first-request-search"
          onServiceTypeSelect={handleServiceTypeSelect}
          onTicketSubmit={handleTicketSubmit}
        />

        {(savedTickets.length > 0 || quickPicks.length > 0) && (
          <div className="mt-3">
            <LookupShortcutRow
              savedTickets={savedTickets}
              recentLookups={[]}
              quickPicks={quickPicks}
              defaultWard={defaultWard}
              onRemoveSaved={handleRemoveSaved}
            />
          </div>
        )}
      </div>
    </div>
  );
}
