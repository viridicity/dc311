import { describe, expect, it, beforeEach, beforeAll } from 'vitest';
import {
  addRecentLookup,
  backfillRecentTicketServiceTypes,
  clearAllLocalPrefs,
  clearSavedLocation,
  formatRecentLookupLabel,
  formatEstimateResultSubtitle,
  formatSubscribedTicketChipLabel,
  filterRecentLookupsExcludingSaved,
  getDefaultWard,
  getRecentLookups,
  getSavedLocation,
  getSubscribedTickets,
  isSubscribedToLookup,
  isSubscribedToTicket,
  isSubscribedTicketEntry,
  reorderSubscribedTickets,
  setUseAddressWardDefault,
  MAX_SUBSCRIBED_TICKETS,
  MAX_TICKET_RECENTS,
  MAX_TYPE_RECENTS,
  setDefaultWard,
  setSavedLocation,
  subscribeToLookup,
  subscribeToTicket,
  unsubscribeFromTicket,
} from './homePreferences';
import { lookupWardFromCoordinates } from './requestFlowMapStyle';

function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    },
  });
}

describe('homePreferences', () => {
  beforeAll(() => {
    installLocalStorageMock();
  });

  beforeEach(() => {
    clearAllLocalPrefs();
  });

  it('stores and returns recent lookups newest-first', () => {
    addRecentLookup({
      serviceType: 'Pothole',
      ward: 'Ward 1',
      label: 'Pothole · Ward 1',
    });
    addRecentLookup({
      ticket: '26-00000001',
      label: 'Ticket 26-00000001',
    });

    const lookups = getRecentLookups();
    expect(lookups).toHaveLength(2);
    expect(lookups[0].ticket).toBe('26-00000001');
    expect(lookups[1].serviceType).toBe('Pothole');
  });

  it('keeps ticket lookups when type pool overflows', () => {
    for (let i = 0; i < MAX_TYPE_RECENTS + 2; i += 1) {
      addRecentLookup({
        serviceType: `Type ${i}`,
        label: `Type ${i} · Citywide`,
      });
    }
    addRecentLookup({ ticket: '26-00000001', label: 'Ticket 26-00000001' });
    addRecentLookup({ ticket: '26-00000002', label: 'Ticket 26-00000002' });

    const lookups = getRecentLookups();
    const tickets = lookups.filter((l) => l.ticket);
    expect(tickets).toHaveLength(2);
    expect(lookups.length).toBeLessThanOrEqual(MAX_TYPE_RECENTS + MAX_TICKET_RECENTS);
  });

  it('caps ticket lookups independently of types', () => {
    for (let i = 0; i < MAX_TICKET_RECENTS + 2; i += 1) {
      addRecentLookup({
        ticket: `26-0000000${i}`,
        label: `Ticket 26-0000000${i}`,
      });
    }
    expect(getRecentLookups().filter((l) => l.ticket)).toHaveLength(MAX_TICKET_RECENTS);
  });

  it('dedupes ticket lookups and refreshes timestamp', () => {
    addRecentLookup({ ticket: '26-00000001', label: 'Ticket 26-00000001' });
    const first = getRecentLookups()[0].savedAt;
    addRecentLookup({ ticket: '26-00000001', label: 'Ticket 26-00000001 · Ward 2', ward: 'Ward 2' });
    const lookups = getRecentLookups();
    expect(lookups).toHaveLength(1);
    expect(lookups[0].savedAt).toBeGreaterThanOrEqual(first);
    expect(lookups[0].ward).toBe('Ward 2');
  });

  it('excludes saved tickets from recent shortcut rows', () => {
    addRecentLookup({ ticket: '26-00000001', label: 'Ticket 26-00000001' });
    addRecentLookup({ ticket: '26-00000002', label: 'Ticket 26-00000002' });
    addRecentLookup({ serviceType: 'Pothole', label: 'Pothole · Citywide' });
    subscribeToTicket({ id: '26-00000001', serviceType: 'Pothole', ward: 'Ward 1' });

    const filtered = filterRecentLookupsExcludingSaved(
      getRecentLookups(),
      getSubscribedTickets(),
    );
    expect(filtered.map((l) => l.ticket ?? l.serviceType)).toEqual([
      '26-00000002',
      'Pothole',
    ]);
  });

  it('excludes saved service-type lookups from recent shortcut rows', () => {
    addRecentLookup({ serviceType: 'Pothole', ward: 'Ward 2', label: 'Pothole · Ward 2' });
    addRecentLookup({ serviceType: 'Bulk Collection', label: 'Bulk trash pickup · Citywide' });
    subscribeToLookup({ serviceType: 'Pothole', ward: 'Ward 2' });

    const filtered = filterRecentLookupsExcludingSaved(
      getRecentLookups(),
      getSubscribedTickets(),
    );
    expect(filtered.map((l) => l.serviceType)).toEqual(['Bulk Collection']);
  });

  it('preserves service type on ticket recents for chip labels', () => {
    addRecentLookup({
      ticket: '26-00000001',
      serviceType: 'Pothole',
      ward: 'Ward 2',
      label: '26-00000001 · Pothole',
    });

    const entry = getRecentLookups()[0];
    expect(entry.serviceType).toBe('Pothole');
    expect(formatRecentLookupLabel(entry)).toBe('26-00000001 · Pothole');
  });

  it('formats estimate result subtitles from available lookup fields', () => {
    expect(formatEstimateResultSubtitle({
      ticketId: '26-00000007',
      serviceType: 'Rodent Inspection and Treatment',
      ward: 'Ward 1',
      markerDays: 4,
      isOpen: false,
    })).toBe('26-00000007 · Rodent Inspection and Treatment · Ward 1 · Resolved in 4 days');
    expect(formatEstimateResultSubtitle({
      ticketId: '26-00000007',
      serviceType: 'Rodent Inspection and Treatment',
      ward: 'Ward 1',
      markerDays: 12,
      isOpen: true,
    })).toBe('26-00000007 · Rodent Inspection and Treatment · Ward 1 · Open (12 days)');
    expect(formatEstimateResultSubtitle({
      serviceType: 'Rodent Inspection and Treatment',
      ward: 'Ward 1',
    })).toBe('Rodent Inspection and Treatment · Ward 1');
    expect(formatEstimateResultSubtitle({
      serviceType: 'Pothole',
    })).toBe('Pothole · Citywide');
  });

  it('formats ticket label before service type when both present', () => {
    expect(formatRecentLookupLabel({
      ticket: '26-123',
      serviceType: 'Pothole',
      ward: 'Ward 2',
    })).toBe('26-123 · Pothole');
    expect(formatRecentLookupLabel({ ticket: '26-123', ward: 'Ward 2' }))
      .toBe('26-123 · Ward 2');
    expect(formatRecentLookupLabel({
      serviceType: 'Bulk Collection',
      ward: 'Ward 3',
      waitDays: 10,
    })).toBe('Bulk trash pickup · Ward 3');
    expect(formatRecentLookupLabel({ serviceType: 'Pothole' }))
      .toBe('Pothole · Citywide');
  });

  it('backfills missing service type on ticket recents from resolver', () => {
    addRecentLookup({
      ticket: '26-00000002',
      ward: 'Ward 6',
      label: '26-00000002 · Ward 6',
    });

    backfillRecentTicketServiceTypes((id) => (
      id === '26-00000002' ? 'Pothole' : null
    ));

    const entry = getRecentLookups()[0];
    expect(entry.serviceType).toBe('Pothole');
    expect(formatRecentLookupLabel(entry)).toBe('26-00000002 · Pothole');
  });

  it('stores ticket entries with service type for chip labels', () => {
    addRecentLookup({
      ticket: '26-00000001',
      serviceType: 'Pothole',
      ward: 'Ward 1',
      label: '26-00000001 · Pothole',
    });
    const entry = getRecentLookups()[0];
    expect(entry.ticket).toBe('26-00000001');
    expect(entry.serviceType).toBe('Pothole');
  });

  describe('defaultWard', () => {
    it('sets and gets default ward', () => {
      setDefaultWard('Ward 7');
      expect(getDefaultWard()).toBe('Ward 7');
    });

    it('clears default ward', () => {
      setDefaultWard('Ward 7');
      setDefaultWard(null);
      expect(getDefaultWard()).toBeNull();
    });

    it('rejects invalid ward values', () => {
      setDefaultWard('Not A Ward');
      expect(getDefaultWard()).toBeNull();
    });

    it('clears stale invalid ward on read', () => {
      localStorage.setItem('dc311_default_ward', '"Ward 99"');
      expect(getDefaultWard()).toBeNull();
    });

    it('uses area ward when that option is enabled for an address', () => {
      setSavedLocation({
        address: '1600 Pennsylvania Ave NW',
        lat: 38.8977,
        lon: -77.0365,
        savedAt: Date.now(),
      });
      setUseAddressWardDefault(true);
      expect(getDefaultWard()).toBe(lookupWardFromCoordinates(38.8977, -77.0365));
    });

    it('uses area ward when that option is enabled for a ward pick', () => {
      setSavedLocation({
        address: 'Near Ward 4',
        lat: 38.9480,
        lon: -77.0160,
        savedAt: Date.now(),
      });
      setUseAddressWardDefault(true);
      expect(getDefaultWard()).toBe('Ward 4');
    });

    it('falls back to stored ward when area override is off', () => {
      setSavedLocation({
        address: '1600 Pennsylvania Ave NW',
        lat: 38.8977,
        lon: -77.0365,
        savedAt: Date.now(),
      });
      setDefaultWard('Ward 4');
      setUseAddressWardDefault(false);
      expect(getDefaultWard()).toBe('Ward 4');
    });

    it('clearAllLocalPrefs removes lookups and ward', () => {
      setDefaultWard('Ward 3');
      addRecentLookup({ serviceType: 'Pothole', label: 'Pothole · Citywide' });
      subscribeToTicket({ id: '26-00000001' });
      setSavedLocation({
        address: '1234 H St NE',
        lat: 38.9,
        lon: -77.0,
        savedAt: Date.now(),
      });
      clearAllLocalPrefs();
      expect(getDefaultWard()).toBeNull();
      expect(getRecentLookups()).toHaveLength(0);
      expect(getSubscribedTickets()).toHaveLength(0);
      expect(getSavedLocation()).toBeNull();
    });
  });

  describe('subscribedTickets', () => {
    it('stores and returns saved searches in save order', () => {
      subscribeToTicket({ id: '26-00000001', serviceType: 'Pothole', ward: 'Ward 1' });
      subscribeToTicket({ id: '26-00000002' });

      const tickets = getSubscribedTickets();
      expect(tickets).toHaveLength(2);
      expect(tickets[0].id).toBe('26-00000002');
      expect(tickets[1].serviceType).toBe('Pothole');
    });

    it('normalizes ticket ids on subscribe', () => {
      subscribeToTicket({ id: '2600000003' });
      expect(isSubscribedToTicket('26-00000003')).toBe(true);
    });

    it('rejects invalid ticket ids', () => {
      expect(subscribeToTicket({ id: 'not-a-ticket' })).toBe(false);
      expect(getSubscribedTickets()).toHaveLength(0);
    });

    it('dedupes subscriptions and refreshes metadata', () => {
      subscribeToTicket({ id: '26-00000001' });
      subscribeToTicket({ id: '26-00000001', serviceType: 'Pothole', ward: 'Ward 4' });

      const tickets = getSubscribedTickets();
      expect(tickets).toHaveLength(1);
      expect(tickets[0].serviceType).toBe('Pothole');
      expect(tickets[0].ward).toBe('Ward 4');
    });

    it('caps subscribed tickets', () => {
      for (let i = 0; i < MAX_SUBSCRIBED_TICKETS + 2; i += 1) {
        subscribeToTicket({ id: `26-000000${i}` });
      }
      expect(getSubscribedTickets()).toHaveLength(MAX_SUBSCRIBED_TICKETS);
    });

    it('unsubscribes by ticket id', () => {
      subscribeToTicket({ id: '26-00000001' });
      unsubscribeFromTicket('26-00000001');
      expect(getSubscribedTickets()).toHaveLength(0);
      expect(isSubscribedToTicket('26-00000001')).toBe(false);
    });

    it('formats subscribed ticket chip labels', () => {
      expect(formatSubscribedTicketChipLabel({
        id: '26-00000001',
        subscribedAt: Date.now(),
      })).toBe('26-00000001 · Citywide');
      expect(formatSubscribedTicketChipLabel({
        id: '26-00000001',
        serviceType: 'Pothole',
        ward: 'Ward 2',
        subscribedAt: Date.now(),
      })).toBe('26-00000001 · Pothole');
    });

    it('stores and formats saved service-type lookups', () => {
      subscribeToLookup({ serviceType: 'Bulk Collection', ward: 'Ward 3' });
      subscribeToLookup({ serviceType: 'Pothole' });

      const saved = getSubscribedTickets();
      expect(saved).toHaveLength(2);
      expect(isSubscribedToLookup('Bulk Collection', 'Ward 3')).toBe(true);
      expect(isSubscribedToLookup('Pothole', null)).toBe(true);
      expect(isSubscribedTicketEntry(saved[0])).toBe(false);
      expect(formatSubscribedTicketChipLabel(saved.find((entry) => entry.serviceType === 'Pothole')!))
        .toBe('Pothole · Citywide');
      expect(formatSubscribedTicketChipLabel(saved.find((entry) => entry.serviceType === 'Bulk Collection')!))
        .toBe('Bulk trash pickup · Ward 3');
    });

    it('unsubscribes saved service-type lookups by storage id', () => {
      subscribeToLookup({ serviceType: 'Pothole', ward: 'Ward 1' });
      const [saved] = getSubscribedTickets();
      unsubscribeFromTicket(saved.id);
      expect(getSubscribedTickets()).toHaveLength(0);
      expect(isSubscribedToLookup('Pothole', 'Ward 1')).toBe(false);
    });

    it('reorders saved searches in profile order', () => {
      subscribeToTicket({ id: '26-00000001' });
      subscribeToTicket({ id: '26-00000002' });
      subscribeToLookup({ serviceType: 'Pothole', ward: 'Ward 1' });

      reorderSubscribedTickets([
        '26-00000001',
        'type|Pothole|Ward 1',
        '26-00000002',
      ]);
      expect(getSubscribedTickets().map((entry) => entry.id)).toEqual([
        '26-00000001',
        'type|Pothole|Ward 1',
        '26-00000002',
      ]);
    });
  });

  describe('savedLocation', () => {
    it('stores and clears saved address coordinates', () => {
      setSavedLocation({
        address: '1600 Pennsylvania Ave NW',
        lat: 38.8977,
        lon: -77.0365,
        savedAt: Date.now(),
      });
      const saved = getSavedLocation();
      expect(saved?.address).toBe('1600 Pennsylvania Ave NW');
      expect(saved?.lat).toBeCloseTo(38.8977);
      clearSavedLocation();
      expect(getSavedLocation()).toBeNull();
    });
  });
});
