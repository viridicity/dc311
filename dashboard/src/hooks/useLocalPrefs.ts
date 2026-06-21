import { useCallback, useEffect, useState } from 'react';
import {
  PREFS_CHANGE_EVENT,
  RecentLookup,
  SavedLocation,
  SubscribedTicket,
  getDefaultWard,
  getRecentLookups,
  getSavedLocation,
  getSubscribedTickets,
  setDefaultWard as persistDefaultWard,
} from '../lib/homePreferences';

function subscribePrefs(onChange: () => void): () => void {
  const refresh = () => onChange();
  window.addEventListener(PREFS_CHANGE_EVENT, refresh);
  window.addEventListener('storage', refresh);
  return () => {
    window.removeEventListener(PREFS_CHANGE_EVENT, refresh);
    window.removeEventListener('storage', refresh);
  };
}

/** Reactive recent lookups — updates across tabs and after writes in this tab. */
export function useRecentLookups(): RecentLookup[] {
  const [lookups, setLookups] = useState(getRecentLookups);

  useEffect(() => subscribePrefs(() => setLookups(getRecentLookups())), []);

  return lookups;
}

/** Reactive default ward with a setter that persists to localStorage. */
export function useDefaultWard(): [string | null, (ward: string | null) => void] {
  const [ward, setWardState] = useState(getDefaultWard);

  useEffect(() => subscribePrefs(() => setWardState(getDefaultWard())), []);

  const setWard = useCallback((next: string | null) => {
    persistDefaultWard(next);
    setWardState(getDefaultWard());
  }, []);

  return [ward, setWard];
}

/** Reactive saved map location. */
export function useSavedLocation(): SavedLocation | null {
  const [location, setLocation] = useState(getSavedLocation);

  useEffect(() => subscribePrefs(() => setLocation(getSavedLocation())), []);

  return location;
}

/** Reactive subscribed tickets — updates across tabs and after writes in this tab. */
export function useSubscribedTickets(): SubscribedTicket[] {
  const [tickets, setTickets] = useState(getSubscribedTickets);

  useEffect(() => subscribePrefs(() => setTickets(getSubscribedTickets())), []);

  return tickets;
}
