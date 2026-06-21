import { DragEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { trackTicketSave, trackTicketRemove } from '../../lib/analytics';
import { handoffToEstimate } from '../../lib/estimateHandoff';
import { useDashboard } from '../../context/DashboardContext';
import {
  PREFS_CHANGE_EVENT,
  SubscribedTicket,
  formatSubscribedTicketChipLabel,
  formatSubscribedTicketLabel,
  getSubscribedTickets,
  isSubscribedTicketEntry,
  reorderSubscribedTickets,
  subscribeToTicket,
  unsubscribeFromTicket,
} from '../../lib/homePreferences';
import {
  FIELD_HINT_CLASS,
  PROFILE_INSET_CLASS,
  SURFACE_INPUT_CLASS,
} from '../shared/surfaceStyles';

function DragHandle({
  label,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label={label}
      title="Drag to reorder"
      className="shrink-0 px-2 flex items-center self-stretch border-r border-border text-text-muted cursor-grab active:cursor-grabbing hover:bg-gray-50 hover:text-gray-700 transition-colors touch-none"
    >
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden className="opacity-70">
        <circle cx="5" cy="4" r="1.25" fill="currentColor" />
        <circle cx="11" cy="4" r="1.25" fill="currentColor" />
        <circle cx="5" cy="8" r="1.25" fill="currentColor" />
        <circle cx="11" cy="8" r="1.25" fill="currentColor" />
        <circle cx="5" cy="12" r="1.25" fill="currentColor" />
        <circle cx="11" cy="12" r="1.25" fill="currentColor" />
      </svg>
    </div>
  );
}

/** Manage saved searches inside the Profile panel. */
export default function SubscribedTicketsForm() {
  const { setActiveTab } = useDashboard();
  const [searches, setSearches] = useState<SubscribedTicket[]>([]);
  const [ticketInput, setTicketInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setSearches(getSubscribedTickets());
  }, []);

  useEffect(() => {
    refresh();
    const onPrefsChange = () => refresh();
    window.addEventListener(PREFS_CHANGE_EVENT, onPrefsChange);
    window.addEventListener('storage', onPrefsChange);
    return () => {
      window.removeEventListener(PREFS_CHANGE_EVENT, onPrefsChange);
      window.removeEventListener('storage', onPrefsChange);
    };
  }, [refresh]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    const trimmed = ticketInput.trim();
    if (!trimmed) return;

    const ok = subscribeToTicket({ id: trimmed });
    if (!ok) {
      setError('Enter a valid ticket ID, like 26-00123456.');
      return;
    }

    setTicketInput('');
    setError(null);
    trackTicketSave('profile');
    refresh();
  }, [ticketInput, refresh]);

  const handleRemove = useCallback((id: string) => {
    unsubscribeFromTicket(id);
    trackTicketRemove('profile');
    refresh();
  }, [refresh]);

  const handleDragStart = useCallback((id: string, event: DragEvent<HTMLDivElement>) => {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!draggingId || draggingId === targetId) return;

    const ids = searches.map((entry) => entry.id);
    const fromIndex = ids.indexOf(draggingId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const nextIds = [...ids];
    nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, draggingId);
    reorderSubscribedTickets(nextIds);
    setDraggingId(null);
    setDragOverId(null);
    refresh();
  }, [draggingId, refresh, searches]);

  const handleOpen = useCallback((entry: SubscribedTicket) => {
    if (isSubscribedTicketEntry(entry)) {
      handoffToEstimate(
        { ticket: entry.id, ward: entry.ward ?? null },
        setActiveTab,
        'subscribed_ticket',
      );
      return;
    }
    if (entry.serviceType) {
      handoffToEstimate(
        { serviceType: entry.serviceType, ward: entry.ward ?? null },
        setActiveTab,
        'subscribed_ticket',
      );
    }
  }, [setActiveTab]);

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <label className="sr-only" htmlFor="profile-save-ticket">311 ticket ID</label>
        <input
          id="profile-save-ticket"
          type="text"
          value={ticketInput}
          onChange={(event) => {
            setTicketInput(event.target.value);
            setError(null);
          }}
          placeholder="26-00123456"
          className={SURFACE_INPUT_CLASS}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!ticketInput.trim()}
          className="inline-flex items-center justify-center min-h-[44px] px-4 text-caption font-medium rounded-md border border-border bg-surface hover:bg-gray-50 text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          Add ticket
        </button>
      </form>

      {error && (
        <p className="text-caption text-amber-800 mb-0">{error}</p>
      )}

      {searches.length > 0 ? (
        <ul className={`${PROFILE_INSET_CLASS} divide-y divide-border`}>
          {searches.map((entry) => {
            const label = formatSubscribedTicketChipLabel(entry);
            const ariaLabel = formatSubscribedTicketLabel(entry);
            const isDragging = draggingId === entry.id;
            const isDropTarget = dragOverId === entry.id && draggingId !== entry.id;

            return (
              <li
                key={entry.id}
                className={`flex items-stretch bg-surface transition-colors ${
                  isDragging ? 'opacity-50' : ''
                } ${isDropTarget ? 'bg-blue-50' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDragOverId(entry.id);
                }}
                onDragLeave={() => {
                  setDragOverId((current) => (current === entry.id ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(entry.id);
                }}
              >
                <DragHandle
                  label={`Drag to reorder ${ariaLabel}`}
                  onDragStart={(event) => handleDragStart(entry.id, event)}
                  onDragEnd={handleDragEnd}
                />
                <button
                  type="button"
                  onClick={() => handleOpen(entry)}
                  className="flex-1 text-left px-3 py-2.5 text-caption text-gray-800 hover:bg-blue-50 transition-colors"
                >
                  {label}
                </button>
                <button
                  type="button"
                  aria-label={`Remove saved search ${ariaLabel}`}
                  onClick={() => handleRemove(entry.id)}
                  className="px-3 text-text-muted hover:text-gray-900 hover:bg-gray-50 border-l border-border transition-colors"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={FIELD_HINT_CLASS}>
          No saved searches yet.
        </p>
      )}
    </div>
  );
}
