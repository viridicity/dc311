import { useCallback } from 'react';
import { formatTicketChipLabel, formatTypeChipLabel } from '../../lib/homePreferences';

interface SaveSearchButtonProps {
  ticketId?: string | null;
  serviceType?: string | null;
  ward?: string | null;
  isSaved: boolean;
  onSave: () => void;
  onRemove: () => void;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden
      className={filled ? 'text-amber-500 fill-current' : 'text-gray-400 fill-none stroke-current'}
      strokeWidth={filled ? 0 : 1.5}
    >
      <path d="M12 2.5l2.89 5.85 6.46.94-4.68 4.56 1.1 6.43L12 17.9l-5.77 3.03 1.1-6.43-4.68-4.56 6.46-.94L12 2.5z" />
    </svg>
  );
}

function describeSearch(
  ticketId?: string | null,
  serviceType?: string | null,
  ward?: string | null,
): string {
  if (ticketId) {
    return formatTicketChipLabel(ticketId, serviceType, ward);
  }
  if (serviceType) {
    return formatTypeChipLabel(serviceType, ward, { shortLabel: false });
  }
  return 'search';
}

/** Star toggle to save or remove the current ticket or service-type search. */
export default function SaveSearchButton({
  ticketId = null,
  serviceType = null,
  ward = null,
  isSaved,
  onSave,
  onRemove,
}: SaveSearchButtonProps) {
  const label = describeSearch(ticketId, serviceType, ward);

  const handleClick = useCallback(() => {
    if (isSaved) {
      onRemove();
      return;
    }
    onSave();
  }, [isSaved, onRemove, onSave]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove saved search ${label}` : `Save search ${label}`}
      title={isSaved ? 'Saved search' : 'Save search'}
      className="shrink-0 w-11 h-11 flex items-center justify-center rounded-md border border-border text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors aria-pressed:border-amber-200 aria-pressed:bg-amber-50 aria-pressed:text-amber-600"
    >
      <StarIcon filled={isSaved} />
    </button>
  );
}
