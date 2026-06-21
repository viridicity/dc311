import {
  RecentLookup,
  formatRecentLookupChipLabel,
  formatRecentLookupLabel,
} from '../../lib/homePreferences';
import {
  QUICK_PICK_CHIP_CLASS,
  TICKET_CHIP_CLASS,
  TICKET_CHIP_SPLIT_CLASS,
  TYPE_CHIP_SPLIT_CLASS,
} from './surfaceStyles';

interface RecentLookupChipProps {
  lookup: RecentLookup;
  onSelect: (lookup: RecentLookup) => void;
  onRemove?: (id: string) => void;
}

/** Compact pill for a saved lookup — single line with optional remove control. */
export default function RecentLookupChip({ lookup, onSelect, onRemove }: RecentLookupChipProps) {
  const label = formatRecentLookupChipLabel(lookup);
  const isTicket = Boolean(lookup.ticket);
  const chipClass = isTicket ? TICKET_CHIP_CLASS : QUICK_PICK_CHIP_CLASS;

  if (!onRemove) {
    return (
      <button
        type="button"
        onClick={() => onSelect(lookup)}
        aria-label={formatRecentLookupLabel(lookup)}
        className={chipClass}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={`inline-flex items-stretch rounded-full border overflow-hidden ${isTicket ? TICKET_CHIP_SPLIT_CLASS : TYPE_CHIP_SPLIT_CLASS}`}>
      <button
        type="button"
        onClick={() => onSelect(lookup)}
        aria-label={formatRecentLookupLabel(lookup)}
        className={`text-caption px-2.5 py-1 min-h-[32px] hover:bg-gray-100 text-gray-800 transition-colors ${isTicket ? 'hover:bg-blue-50' : ''}`}
      >
        {label}
      </button>
      <button
        type="button"
        aria-label={`Remove ${formatRecentLookupLabel(lookup)}`}
        onClick={() => onRemove(lookup.id)}
        className="px-2 min-h-[32px] text-text-muted hover:text-gray-900 hover:bg-gray-100 border-l border-border transition-colors"
      >
        ×
      </button>
    </span>
  );
}
