import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { handoffToEstimate } from '../../lib/estimateHandoff';
import { trackHomeReturnClick } from '../../lib/analytics';
import {
  RecentLookup,
  SubscribedTicket,
  formatTypeChipLabel,
  filterRecentLookupsExcludingSaved,
} from '../../lib/homePreferences';
import RecentLookupChip from './RecentLookupChip';
import SubscribedTicketChips from './SubscribedTicketChips';
import {
  QUICK_PICK_CHIP_CLASS,
  SHORTCUT_ROW_TWO_LINE_MAX_HEIGHT_PX,
} from './surfaceStyles';

interface LookupShortcutRowProps {
  savedTickets: SubscribedTicket[];
  recentLookups: RecentLookup[];
  quickPicks: string[];
  defaultWard?: string | null;
  /** When set, shortcuts apply in place instead of handing off from Home. */
  onResumeLookup?: (lookup: RecentLookup) => void;
  onQuickPick?: (serviceType: string) => void;
  onOpenSavedTicket?: (ticket: SubscribedTicket) => void;
  onRemoveRecent?: (id: string) => void;
  onRemoveSaved?: (ticketId: string) => void;
  onClearRecents?: () => void;
  showClearRecents?: boolean;
  /** Home uses search for discovery; Estimate keeps common-request chips. */
  showCommonRequests?: boolean;
}

type FlatShortcutItem =
  | { key: string; kind: 'label'; text: string }
  | { key: string; kind: 'saved'; ticket: SubscribedTicket }
  | { key: string; kind: 'recent'; lookup: RecentLookup }
  | { key: string; kind: 'common'; serviceType: string };

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-caption font-semibold text-text-muted shrink-0">
      {children}
    </span>
  );
}

function ToggleButton({
  label,
  ariaLabel,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="text-caption text-text-muted hover:text-gray-900 transition-colors shrink-0 min-h-[32px] px-1"
    >
      {label}
    </button>
  );
}

function buildFlatItems(
  savedTickets: SubscribedTicket[],
  visibleRecents: RecentLookup[],
  quickPicks: string[],
  showCommonRequests: boolean,
): FlatShortcutItem[] {
  const items: FlatShortcutItem[] = [];

  if (savedTickets.length > 0) {
    items.push({ key: 'label-saved', kind: 'label', text: 'Saved searches' });
    for (const ticket of savedTickets) {
      items.push({ key: `saved-${ticket.id}`, kind: 'saved', ticket });
    }
  }
  if (visibleRecents.length > 0) {
    items.push({ key: 'label-recent', kind: 'label', text: 'Recent' });
    for (const lookup of visibleRecents) {
      items.push({ key: `recent-${lookup.id}`, kind: 'recent', lookup });
    }
  }
  if (showCommonRequests && quickPicks.length > 0) {
    items.push({ key: 'label-common', kind: 'label', text: 'Common requests' });
    for (const serviceType of quickPicks) {
      items.push({ key: `common-${serviceType}`, kind: 'common', serviceType });
    }
  }

  return items;
}

/** Drop a trailing section label so collapsed rows never end on an empty heading. */
function trimTrailingLabels(items: FlatShortcutItem[]): FlatShortcutItem[] {
  let end = items.length;
  while (end > 0 && items[end - 1].kind === 'label') {
    end -= 1;
  }
  return end === items.length ? items : items.slice(0, end);
}

function countPills(items: FlatShortcutItem[]): number {
  return items.filter((item) => item.kind !== 'label').length;
}

/** Saved, recent, and popular shortcuts in one labeled chip row. */
export default function LookupShortcutRow({
  savedTickets,
  recentLookups,
  quickPicks,
  defaultWard = null,
  onResumeLookup,
  onQuickPick,
  onOpenSavedTicket,
  onRemoveRecent,
  onRemoveSaved,
  onClearRecents,
  showClearRecents = false,
  showCommonRequests = true,
}: LookupShortcutRowProps) {
  const { setActiveTab } = useDashboard();
  const visibleRecents = filterRecentLookupsExcludingSaved(recentLookups, savedTickets);
  const pillsRef = useRef<HTMLDivElement>(null);

  const flatItems = useMemo(
    () => buildFlatItems(savedTickets, visibleRecents, quickPicks, showCommonRequests),
    [savedTickets, visibleRecents, quickPicks, showCommonRequests],
  );

  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(flatItems.length);

  const listSignature = useMemo(
    () => flatItems.map((item) => item.key).join('|'),
    [flatItems],
  );

  useEffect(() => {
    setVisibleCount(flatItems.length);
    setExpanded(false);
  }, [listSignature, flatItems.length]);

  const resumeLookupHome = useCallback((lookup: RecentLookup) => {
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

  const resumeLookup = onResumeLookup ?? resumeLookupHome;

  const handleQuickPickHome = useCallback((serviceType: string) => {
    handoffToEstimate(
      { serviceType, ward: defaultWard ?? null },
      setActiveTab,
      'home_quick_pick',
    );
  }, [defaultWard, setActiveTab]);

  const handleQuickPick = onQuickPick ?? handleQuickPickHome;

  const showClearRecentsLink = showClearRecents && onClearRecents && visibleRecents.length > 1;
  const collapsedItems = trimTrailingLabels(flatItems.slice(0, visibleCount));
  const hasHiddenPills = countPills(collapsedItems) < countPills(flatItems);
  const showMore = !expanded && hasHiddenPills;
  const showLess = expanded && hasHiddenPills;

  useLayoutEffect(() => {
    if (expanded) return;
    const el = pillsRef.current;
    if (!el || flatItems.length === 0) return;

    if (el.scrollHeight <= SHORTCUT_ROW_TWO_LINE_MAX_HEIGHT_PX + 1) {
      return;
    }
    if (visibleCount > 0) {
      setVisibleCount((count) => count - 1);
    }
  }, [expanded, flatItems.length, visibleCount, showMore]);

  useLayoutEffect(() => {
    if (expanded) return;

    const onResize = () => setVisibleCount(flatItems.length);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [expanded, flatItems.length]);

  const renderItem = useCallback((item: FlatShortcutItem) => {
    switch (item.kind) {
      case 'label':
        return <SectionLabel>{item.text}</SectionLabel>;
      case 'saved':
        return (
          <SubscribedTicketChips
            tickets={[item.ticket]}
            onOpenTicket={onOpenSavedTicket}
            onRemove={onRemoveSaved}
          />
        );
      case 'recent':
        return (
          <RecentLookupChip
            lookup={item.lookup}
            onSelect={resumeLookup}
            onRemove={onRemoveRecent}
          />
        );
      case 'common':
        return (
          <button
            type="button"
            onClick={() => handleQuickPick(item.serviceType)}
            className={QUICK_PICK_CHIP_CLASS}
          >
            {formatTypeChipLabel(item.serviceType, null, { includeScope: false })}
          </button>
        );
      default:
        return null;
    }
  }, [handleQuickPick, onOpenSavedTicket, onRemoveRecent, onRemoveSaved, resumeLookup]);

  if (flatItems.length === 0) {
    return null;
  }

  const displayItems = expanded ? flatItems : collapsedItems;

  return (
    <div>
      <div
        ref={pillsRef}
        className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
      >
        {displayItems.map((item) => (
          <span key={item.key} className="inline-flex">
            {renderItem(item)}
          </span>
        ))}
        {showMore && (
          <ToggleButton
            label="More…"
            ariaLabel="Show more shortcuts"
            onClick={() => setExpanded(true)}
          />
        )}
        {showLess && (
          <ToggleButton
            label="Less…"
            ariaLabel="Show fewer shortcuts"
            onClick={() => {
              setExpanded(false);
              setVisibleCount(flatItems.length);
            }}
          />
        )}
      </div>
      {showClearRecentsLink && (
        <div className="mt-2">
          <button
            type="button"
            onClick={onClearRecents}
            className="text-caption text-text-muted hover:text-gray-900 transition-colors"
          >
            Clear recent history
          </button>
        </div>
      )}
    </div>
  );
}
