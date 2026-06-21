import { EstimateUrlState, formatDays, looksLikeTicketId, normalizeTicketId } from './estimateData';
import { quickPickDisplayLabel } from './quickPickLabels';
import { WARD_ORDER } from './constants';
import {
  isWardApproxSavedAddress,
  lookupWardFromCoordinates,
} from './requestFlowMapStyle';

const RECENT_LOOKUPS_KEY = 'dc311_recent_lookups';
const DEFAULT_WARD_KEY = 'dc311_default_ward';
const USE_ADDRESS_WARD_KEY = 'dc311_use_address_ward_default';
const SAVED_LOCATION_KEY = 'dc311_saved_location';
const SUBSCRIBED_TICKETS_KEY = 'dc311_subscribed_tickets';

export interface SavedLocation {
  address: string;
  lat: number;
  lon: number;
  savedAt: number;
}

export const PREFS_CHANGE_EVENT = 'dc311-prefs-change';

export const MAX_TYPE_RECENTS = 4;
export const MAX_TICKET_RECENTS = 3;
export const MAX_SUBSCRIBED_TICKETS = 10;

/** @deprecated Use MAX_TYPE_RECENTS / MAX_TICKET_RECENTS — kept for test migration. */
export const MAX_RECENT_LOOKUPS = MAX_TYPE_RECENTS;

export interface RecentLookup extends EstimateUrlState {
  id: string;
  label: string;
  savedAt: number;
}

export interface SubscribedTicket {
  id: string;
  ticket?: string | null;
  serviceType?: string | null;
  ward?: string | null;
  subscribedAt: number;
}

function readRecentRaw(): RecentLookup[] {
  try {
    const raw = localStorage.getItem(RECENT_LOOKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentLookup[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) => entry && typeof entry.id === 'string' && typeof entry.label === 'string',
    );
  } catch {
    return [];
  }
}

function writeRecentRaw(entries: RecentLookup[]): void {
  try {
    localStorage.setItem(RECENT_LOOKUPS_KEY, JSON.stringify(entries));
    notifyPrefsChange();
  } catch {
    // Storage may be unavailable in private mode.
  }
}

/** Broadcasts preference changes to hooks in this tab. */
export function notifyPrefsChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PREFS_CHANGE_EVENT));
}

function isValidWard(ward: string): boolean {
  return WARD_ORDER.includes(ward as (typeof WARD_ORDER)[number]);
}

/** Returns saved lookups newest-first. */
export function getRecentLookups(): RecentLookup[] {
  return readRecentRaw()
    .map(enrichRecentTicketFromSubscribed)
    .sort((a, b) => b.savedAt - a.savedAt);
}

function subscribedTypeForTicket(ticketId: string): string | null {
  const normalized = normalizeTicketId(ticketId.trim());
  const match = readSubscribedTicketsRaw().find(
    (entry) => isSubscribedTicketEntry(entry) && entry.id === normalized,
  );
  return match?.serviceType?.trim() || null;
}

/** True when a saved entry is a ticket shortcut rather than a service-type lookup. */
export function isSubscribedTicketEntry(entry: SubscribedTicket): boolean {
  if (entry.ticket) return true;
  return looksLikeTicketId(entry.id);
}

function savedLookupId(serviceType: string, ward: string | null): string {
  return ['type', serviceType, ward ?? ''].join('|');
}

export function getSavedLookupId(serviceType: string, ward: string | null): string {
  return savedLookupId(serviceType, ward);
}

function resolveTicketServiceType(
  ticketId: string,
  serviceType?: string | null,
): string | null {
  if (serviceType?.trim()) return serviceType.trim();
  return subscribedTypeForTicket(ticketId);
}

function enrichRecentTicketFromSubscribed(entry: RecentLookup): RecentLookup {
  if (!entry.ticket || entry.serviceType?.trim()) return entry;
  const serviceType = subscribedTypeForTicket(entry.ticket);
  if (!serviceType) return entry;
  return { ...entry, serviceType };
}

/** Fills missing service types on ticket recents from live ticket data. */
export function backfillRecentTicketServiceTypes(
  lookupType: (ticketId: string) => string | null,
): void {
  const raw = readRecentRaw();
  let changed = false;
  const next = raw.map((entry) => {
    if (!entry.ticket || entry.serviceType?.trim()) return entry;
    const serviceType = lookupType(entry.ticket) ?? subscribedTypeForTicket(entry.ticket);
    if (!serviceType) return entry;
    changed = true;
    const enriched = { ...entry, serviceType };
    return { ...enriched, label: formatRecentLookupLabel(enriched) };
  });
  if (changed) writeRecentRaw(next);
}

function isTicketEntry(entry: EstimateUrlState): boolean {
  return Boolean(entry.ticket);
}

function trimRecentPools(entries: RecentLookup[]): RecentLookup[] {
  const tickets = entries.filter((e) => isTicketEntry(e));
  const types = entries.filter((e) => !isTicketEntry(e));
  const trimmedTickets = tickets
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_TICKET_RECENTS);
  const trimmedTypes = types
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_TYPE_RECENTS);
  return [...trimmedTickets, ...trimmedTypes].sort((a, b) => b.savedAt - a.savedAt);
}

/** Dedupes by ticket or type+ward+wait; tickets and types evict in separate pools. */
export function addRecentLookup(entry: EstimateUrlState & { label: string }): void {
  const key = lookupDedupeKey(entry);
  const existing = readRecentRaw().find((item) => lookupDedupeKey(item) === key);
  const withoutDup = readRecentRaw().filter((item) => lookupDedupeKey(item) !== key);
  const stored: EstimateUrlState = entry.ticket
    ? {
        ticket: entry.ticket,
        serviceType: resolveTicketServiceType(
          entry.ticket,
          entry.serviceType ?? existing?.serviceType,
        ),
        ward: entry.ward ?? existing?.ward ?? null,
        waitDays: null,
      }
    : {
        ticket: null,
        serviceType: entry.serviceType ?? null,
        ward: entry.ward ?? null,
        waitDays: entry.waitDays ?? null,
      };
  const next: RecentLookup = {
    ...stored,
    label: formatRecentLookupLabel(stored),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
  };
  writeRecentRaw(trimRecentPools([next, ...withoutDup]));
}

export function removeRecentLookup(id: string): void {
  writeRecentRaw(readRecentRaw().filter((entry) => entry.id !== id));
}

export function clearRecentLookups(): void {
  try {
    localStorage.removeItem(RECENT_LOOKUPS_KEY);
    notifyPrefsChange();
  } catch {
    // Ignore storage errors.
  }
}

/** Returns ward inferred from a saved street address, if any. */
export function getAddressWardFromSavedLocation(): string | null {
  const saved = readSavedLocationRaw();
  if (!saved || isWardApproxSavedAddress(saved.address)) return null;
  return lookupWardFromCoordinates(saved.lat, saved.lon);
}

/** Ward from saved area — street address lookup or explicit ward selection. */
export function getAreaWardFromSavedLocation(): string | null {
  const saved = readSavedLocationRaw();
  if (!saved) return null;
  if (isWardApproxSavedAddress(saved.address)) {
    const ward = saved.address.replace(/^Near /, '');
    return isValidWard(ward) ? ward : null;
  }
  return lookupWardFromCoordinates(saved.lat, saved.lon);
}

/** True when estimate defaults should follow the saved street address ward. */
export function getUseAddressWardDefault(): boolean {
  try {
    return localStorage.getItem(USE_ADDRESS_WARD_KEY) === '1';
  } catch {
    return false;
  }
}

/** Toggles whether estimate defaults follow the saved street address ward. */
export function setUseAddressWardDefault(use: boolean): void {
  try {
    if (use) {
      localStorage.setItem(USE_ADDRESS_WARD_KEY, '1');
    } else {
      localStorage.removeItem(USE_ADDRESS_WARD_KEY);
    }
    notifyPrefsChange();
  } catch {
    // Storage may be unavailable in private mode.
  }
}

/** Returns the manually chosen default ward, ignoring address override. */
export function getStoredDefaultWard(): string | null {
  return readStoredDefaultWard();
}

function readStoredDefaultWard(): string | null {
  try {
    const raw = localStorage.getItem(DEFAULT_WARD_KEY);
    if (!raw) return null;
    if (!isValidWard(raw)) {
      localStorage.removeItem(DEFAULT_WARD_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** Returns the default ward for estimates — from saved area or manual selection. */
export function getDefaultWard(): string | null {
  if (getUseAddressWardDefault()) {
    const fromArea = getAreaWardFromSavedLocation();
    if (fromArea) return fromArea;
  }
  return readStoredDefaultWard();
}

/** Persists or clears the default ward used on fresh Estimate entry. */
export function setDefaultWard(ward: string | null): void {
  try {
    if (ward == null || ward === '') {
      localStorage.removeItem(DEFAULT_WARD_KEY);
    } else if (isValidWard(ward)) {
      localStorage.setItem(DEFAULT_WARD_KEY, ward);
    }
    notifyPrefsChange();
  } catch {
    // Storage may be unavailable in private mode.
  }
}

/** Clears recent lookups, default ward, saved address, and subscriptions. */
export function clearAllLocalPrefs(): void {
  try {
    localStorage.removeItem(RECENT_LOOKUPS_KEY);
    localStorage.removeItem(DEFAULT_WARD_KEY);
    localStorage.removeItem(USE_ADDRESS_WARD_KEY);
    localStorage.removeItem(SAVED_LOCATION_KEY);
    localStorage.removeItem(SUBSCRIBED_TICKETS_KEY);
    notifyPrefsChange();
  } catch {
    // Ignore storage errors.
  }
}

function readSavedLocationRaw(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(SAVED_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocation;
    if (
      !parsed
      || typeof parsed.address !== 'string'
      || typeof parsed.lat !== 'number'
      || typeof parsed.lon !== 'number'
    ) {
      localStorage.removeItem(SAVED_LOCATION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Returns the saved home-map location, or null if unset. */
export function getSavedLocation(): SavedLocation | null {
  return readSavedLocationRaw();
}

/** Persists geocoded coordinates for map centering. */
export function setSavedLocation(location: SavedLocation): void {
  try {
    localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify(location));
    notifyPrefsChange();
  } catch {
    // Storage may be unavailable in private mode.
  }
}

/** Removes the saved address used for map centering. */
export function clearSavedLocation(): void {
  try {
    localStorage.removeItem(SAVED_LOCATION_KEY);
    notifyPrefsChange();
  } catch {
    // Ignore storage errors.
  }
}

function readSubscribedTicketsRaw(): SubscribedTicket[] {
  try {
    const raw = localStorage.getItem(SUBSCRIBED_TICKETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SubscribedTicket[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === 'string');
  } catch {
    return [];
  }
}

function writeSubscribedTicketsRaw(entries: SubscribedTicket[]): void {
  try {
    localStorage.setItem(SUBSCRIBED_TICKETS_KEY, JSON.stringify(entries));
    notifyPrefsChange();
  } catch {
    // Storage may be unavailable in private mode.
  }
}

function normalizeSubscribedTicketId(input: string): string | null {
  const normalized = normalizeTicketId(input.trim());
  return looksLikeTicketId(normalized) ? normalized : null;
}

/** Returns saved searches in profile order. */
export function getSubscribedTickets(): SubscribedTicket[] {
  return readSubscribedTicketsRaw();
}

/** Reorders saved searches to match the given id list. */
export function reorderSubscribedTickets(orderedIds: string[]): void {
  const byId = new Map(readSubscribedTicketsRaw().map((entry) => [entry.id, entry]));
  const next = orderedIds
    .map((id) => byId.get(id))
    .filter((entry): entry is SubscribedTicket => Boolean(entry));
  for (const entry of readSubscribedTicketsRaw()) {
    if (!next.some((item) => item.id === entry.id)) next.push(entry);
  }
  writeSubscribedTicketsRaw(next);
}

/** Omits recent lookups that already appear in Saved. */
export function filterRecentLookupsExcludingSaved(
  lookups: RecentLookup[],
  savedTickets: SubscribedTicket[],
): RecentLookup[] {
  if (savedTickets.length === 0) return lookups;
  const savedTicketIds = new Set(
    savedTickets.filter(isSubscribedTicketEntry).map((ticket) => ticket.id),
  );
  const savedTypeKeys = new Set(
    savedTickets
      .filter((entry) => !isSubscribedTicketEntry(entry) && entry.serviceType)
      .map((entry) => savedLookupId(entry.serviceType!, entry.ward ?? null)),
  );
  return lookups.filter((lookup) => {
    if (lookup.ticket && savedTicketIds.has(lookup.ticket)) return false;
    if (!lookup.ticket && lookup.serviceType) {
      if (savedTypeKeys.has(savedLookupId(lookup.serviceType, lookup.ward ?? null))) return false;
    }
    return true;
  });
}

/** Returns whether a ticket ID is already subscribed. */
export function isSubscribedToTicket(ticketId: string): boolean {
  const normalized = normalizeSubscribedTicketId(ticketId);
  if (!normalized) return false;
  return readSubscribedTicketsRaw().some((entry) => entry.id === normalized);
}

/** Returns whether a service-type lookup is already saved. */
export function isSubscribedToLookup(
  serviceType: string,
  ward: string | null,
): boolean {
  const trimmed = serviceType.trim();
  if (!trimmed) return false;
  const id = savedLookupId(trimmed, ward);
  return readSubscribedTicketsRaw().some((entry) => entry.id === id);
}

/** Adds or refreshes a subscribed ticket; returns false when the ID is invalid. */
export function subscribeToTicket(entry: {
  id: string;
  serviceType?: string | null;
  ward?: string | null;
}): boolean {
  const normalized = normalizeSubscribedTicketId(entry.id);
  if (!normalized) return false;

  const withoutDup = readSubscribedTicketsRaw().filter((item) => item.id !== normalized);
  const existing = readSubscribedTicketsRaw().find((item) => item.id === normalized);
  const next: SubscribedTicket = {
    id: normalized,
    ticket: normalized,
    serviceType: entry.serviceType ?? existing?.serviceType ?? null,
    ward: entry.ward ?? existing?.ward ?? null,
    subscribedAt: Date.now(),
  };
  writeSubscribedTicketsRaw(
    [next, ...withoutDup].slice(0, MAX_SUBSCRIBED_TICKETS),
  );
  return true;
}

/** Adds or refreshes a saved service-type lookup with ward or citywide scope. */
export function subscribeToLookup(entry: {
  serviceType: string;
  ward?: string | null;
}): boolean {
  const serviceType = entry.serviceType.trim();
  if (!serviceType) return false;

  const id = savedLookupId(serviceType, entry.ward ?? null);
  const withoutDup = readSubscribedTicketsRaw().filter((item) => item.id !== id);
  const next: SubscribedTicket = {
    id,
    ticket: null,
    serviceType,
    ward: entry.ward ?? null,
    subscribedAt: Date.now(),
  };
  writeSubscribedTicketsRaw(
    [next, ...withoutDup].slice(0, MAX_SUBSCRIBED_TICKETS),
  );
  return true;
}

/** Removes a saved ticket or service-type lookup. */
export function unsubscribeFromTicket(id: string): void {
  const normalized = normalizeSubscribedTicketId(id);
  const targetId = normalized ?? id;
  writeSubscribedTicketsRaw(
    readSubscribedTicketsRaw().filter((entry) => entry.id !== targetId),
  );
}

/** Single-line chip label for saved shortcut rows. */
export function formatSubscribedTicketChipLabel(ticket: SubscribedTicket): string {
  if (isSubscribedTicketEntry(ticket)) {
    return formatTicketChipLabel(ticket.id, ticket.serviceType, ticket.ward);
  }
  if (ticket.serviceType) {
    return formatTypeChipLabel(ticket.serviceType, ticket.ward);
  }
  return ticket.id;
}

/** Accessible label for subscribed ticket controls. */
export function formatSubscribedTicketLabel(ticket: SubscribedTicket): string {
  return formatSubscribedTicketChipLabel(ticket);
}

function lookupDedupeKey(entry: EstimateUrlState): string {
  if (entry.ticket) return `ticket:${entry.ticket}`;
  return [
    'type',
    entry.serviceType ?? '',
    entry.ward ?? '',
    entry.waitDays ?? '',
  ].join('|');
}

/** Ward name or citywide when no ward is set. */
export function formatRecentLookupScope(ward?: string | null): string {
  return ward?.trim() ? ward : 'Citywide';
}

/** Ticket pill — number plus request type, or ward when type is unknown. */
export function formatTicketChipLabel(
  id: string,
  serviceType?: string | null,
  ward?: string | null,
): string {
  if (serviceType?.trim()) return `${id} · ${serviceType.trim()}`;
  return `${id} · ${formatRecentLookupScope(ward)}`;
}

/** Estimate result subtitle — ticket id, type, ward, and resolution when each is known. */
export function formatEstimateResultSubtitle(options: {
  ticketId?: string | null;
  serviceType: string;
  ward?: string | null;
  markerDays?: number | null;
  isOpen?: boolean | null;
}): string {
  const { ticketId, serviceType, ward, markerDays, isOpen } = options;
  if (ticketId) {
    const parts = [ticketId];
    if (serviceType.trim()) parts.push(serviceType.trim());
    if (ward?.trim()) parts.push(ward.trim());
    if (markerDays != null && markerDays >= 0) {
      parts.push(
        isOpen
          ? `Open (${formatDays(markerDays)} days)`
          : `Resolved in ${formatDays(markerDays)} days`,
      );
    }
    return parts.join(' · ');
  }
  return formatTypeChipLabel(serviceType, ward, { shortLabel: false });
}

/** Service-type pill — optional ward suffix and short display labels. */
export function formatTypeChipLabel(
  serviceType: string,
  ward?: string | null,
  options?: { includeScope?: boolean; shortLabel?: boolean },
): string {
  const { includeScope = true, shortLabel = true } = options ?? {};
  const typeLabel = shortLabel ? quickPickDisplayLabel(serviceType) : serviceType;
  if (!includeScope) return typeLabel;
  return `${typeLabel} · ${formatRecentLookupScope(ward)}`;
}

/** Single-line chip label for recent lookup rows. */
export function formatRecentLookupChipLabel(state: EstimateUrlState): string {
  if (state.ticket) {
    return formatTicketChipLabel(state.ticket, state.serviceType, state.ward);
  }
  if (state.serviceType) {
    return formatTypeChipLabel(state.serviceType, state.ward);
  }
  return 'Lookup';
}

/** Builds an accessible label for recent lookup rows. */
export function formatRecentLookupLabel(state: EstimateUrlState): string {
  return formatRecentLookupChipLabel(state);
}
