import { useCallback } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { handoffToEstimate } from '../../lib/estimateHandoff';
import {
  SubscribedTicket,
  formatSubscribedTicketChipLabel,
  formatSubscribedTicketLabel,
  isSubscribedTicketEntry,
} from '../../lib/homePreferences';
import {
  QUICK_PICK_CHIP_CLASS,
  TICKET_CHIP_CLASS,
  TICKET_CHIP_SPLIT_CLASS,
  TYPE_CHIP_SPLIT_CLASS,
} from './surfaceStyles';

interface SubscribedTicketChipsProps {
  tickets: SubscribedTicket[];
  onOpenTicket?: (ticket: SubscribedTicket) => void;
  onRemove?: (ticketId: string) => void;
}

/** Quick-open pills for tickets and service types saved in the user's profile. */
export default function SubscribedTicketChips({
  tickets,
  onOpenTicket,
  onRemove,
}: SubscribedTicketChipsProps) {
  const { setActiveTab } = useDashboard();

  const openTicketDefault = useCallback((ticket: SubscribedTicket) => {
    if (isSubscribedTicketEntry(ticket)) {
      handoffToEstimate(
        { ticket: ticket.id, ward: ticket.ward ?? null },
        setActiveTab,
        'subscribed_ticket',
      );
      return;
    }
    if (ticket.serviceType) {
      handoffToEstimate(
        { serviceType: ticket.serviceType, ward: ticket.ward ?? null },
        setActiveTab,
        'subscribed_ticket',
      );
    }
  }, [setActiveTab]);

  const openTicket = onOpenTicket ?? openTicketDefault;

  if (tickets.length === 0) {
    return null;
  }

  return (
    <>
      {tickets.map((ticket) => {
        const label = formatSubscribedTicketChipLabel(ticket);
        const ariaLabel = formatSubscribedTicketLabel(ticket);
        const isTicket = isSubscribedTicketEntry(ticket);
        const chipClass = isTicket ? TICKET_CHIP_CLASS : QUICK_PICK_CHIP_CLASS;
        const splitClass = isTicket ? TICKET_CHIP_SPLIT_CLASS : TYPE_CHIP_SPLIT_CLASS;

        if (!onRemove) {
          return (
            <button
              key={ticket.id}
              type="button"
              onClick={() => openTicket(ticket)}
              aria-label={ariaLabel}
              className={chipClass}
            >
              {label}
            </button>
          );
        }

        const removeLabel = isTicket
          ? `Remove saved ticket ${ticket.id}`
          : `Remove saved ${ariaLabel}`;

        return (
          <span
            key={ticket.id}
            className={`inline-flex items-stretch rounded-full border overflow-hidden ${splitClass}`}
          >
            <button
              type="button"
              onClick={() => openTicket(ticket)}
              aria-label={ariaLabel}
              className={`text-caption px-2.5 py-1 min-h-[32px] text-gray-800 transition-colors ${isTicket ? 'hover:bg-blue-50' : 'hover:bg-gray-100'}`}
            >
              {label}
            </button>
            <button
              type="button"
              aria-label={removeLabel}
              onClick={() => onRemove(ticket.id)}
              className="px-2 min-h-[32px] text-text-muted hover:text-gray-900 hover:bg-gray-100 border-l border-border transition-colors"
            >
              ×
            </button>
          </span>
        );
      })}
    </>
  );
}
