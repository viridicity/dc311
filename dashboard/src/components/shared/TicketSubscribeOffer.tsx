import { useCallback } from 'react';
import { formatTypeChipLabel } from '../../lib/homePreferences';
import { trackTicketSave, trackTicketRemove } from '../../lib/analytics';

interface TicketSubscribeOfferProps {
  ticketId?: string;
  serviceType?: string;
  ward?: string | null;
  isSubscribed: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  /** Larger button for the estimate input lookup banner. */
  prominent?: boolean;
}

function describeSavedLookup(
  ticketId?: string,
  serviceType?: string,
  ward?: string | null,
): string {
  if (ticketId) return `ticket ${ticketId}`;
  if (serviceType) return formatTypeChipLabel(serviceType, ward);
  return 'lookup';
}

/** Save or remove a ticket or service-type shortcut from the estimate page. */
export default function TicketSubscribeOffer({
  ticketId,
  serviceType,
  ward = null,
  isSubscribed,
  onSubscribe,
  onUnsubscribe,
  prominent = false,
}: TicketSubscribeOfferProps) {
  const lookupLabel = describeSavedLookup(ticketId, serviceType, ward);
  const saveLabel = ticketId ? 'Save ticket' : 'Save lookup';
  const saveAriaLabel = ticketId
    ? `Save ticket ${ticketId}`
    : `Save lookup ${lookupLabel}`;

  const handleSave = useCallback(() => {
    onSubscribe();
    trackTicketSave('estimate');
  }, [onSubscribe]);

  const handleRemove = useCallback(() => {
    onUnsubscribe();
    trackTicketRemove('estimate');
  }, [onUnsubscribe]);

  if (isSubscribed) {
    return (
      <p className={`text-caption text-text-muted mb-0 ${prominent ? 'shrink-0' : 'mt-1.5'}`}>
        Saved{' '}
        <button
          type="button"
          onClick={handleRemove}
          className="article-link text-caption"
          aria-label={`Remove saved ${lookupLabel}`}
        >
          Remove
        </button>
      </p>
    );
  }

  if (prominent) {
    return (
      <button
        type="button"
        onClick={handleSave}
        className="shrink-0 min-h-[44px] px-3 py-2 text-sm font-medium border border-blue-200 rounded-md bg-blue-50 text-blue-900 hover:bg-blue-100 transition-colors"
        aria-label={saveAriaLabel}
      >
        {saveLabel}
      </button>
    );
  }

  return (
    <p className="text-caption text-text-muted mt-1.5 mb-0">
      Save to your profile for quick access{' '}
      <button
        type="button"
        onClick={handleSave}
        className="article-link text-caption"
        aria-label={saveAriaLabel}
      >
        {saveLabel}
      </button>
    </p>
  );
}
