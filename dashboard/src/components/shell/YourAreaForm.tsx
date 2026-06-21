import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { trackDefaultWardSet, trackSavedLocationSet } from '../../lib/analytics';
import { GeocodeCandidate, searchDcAddressCandidates } from '../../lib/geocodeAddress';
import {
  PREFS_CHANGE_EVENT,
  clearSavedLocation,
  getAreaWardFromSavedLocation,
  getDefaultWard,
  getSavedLocation,
  getStoredDefaultWard,
  getUseAddressWardDefault,
  setDefaultWard,
  setSavedLocation,
  setUseAddressWardDefault,
} from '../../lib/homePreferences';
import {
  getWardMapCenter,
  isWardApproxSavedAddress,
} from '../../lib/requestFlowMapStyle';
import { WARD_ORDER } from '../../lib/constants';
import {
  FIELD_HINT_CLASS,
  FIELD_LABEL_CLASS,
  PROFILE_INSET_CLASS,
  PROFILE_INSET_SECTION_CLASS,
  SURFACE_INPUT_CLASS,
} from '../shared/surfaceStyles';

const SEARCH_DEBOUNCE_MS = 400;
const MIN_SEARCH_LENGTH = 3;
/** Sentinel — empty string makes some browsers show the first ward option instead. */
const CITYWIDE_WARD_VALUE = '__citywide__';

type AreaInputMode = 'address' | 'ward';

function SearchSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-blue-600"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function resetEstimatePrefs(): void {
  setDefaultWard(null);
  setUseAddressWardDefault(false);
}

/** Phase 1: address or ward for map; phase 2: use that ward or pick another for Estimate. */
export default function YourAreaForm() {
  const [savedAddress, setSavedAddressState] = useState<string | null>(null);
  const [storedDefaultWard, setStoredDefaultWardState] = useState<string | null>(null);
  const [useAreaWardDefault, setUseAreaWardDefaultState] = useState(false);
  const [inputMode, setInputMode] = useState<AreaInputMode>('address');
  const [addressInput, setAddressInput] = useState('');
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRequestId = useRef(0);

  const refresh = useCallback(() => {
    const saved = getSavedLocation();
    const streetAddress = saved?.address && !isWardApproxSavedAddress(saved.address)
      ? saved.address
      : null;
    const wardPick = saved?.address && isWardApproxSavedAddress(saved.address)
      ? saved.address.replace(/^Near /, '')
      : null;

    setSavedAddressState(saved?.address ?? null);
    setStoredDefaultWardState(getStoredDefaultWard());
    setUseAreaWardDefaultState(getUseAddressWardDefault());
    setInputMode((current) => {
      if (streetAddress) return 'address';
      if (wardPick) return 'ward';
      return current;
    });
    setAddressInput(streetAddress ?? '');
    setCandidates([]);
    setError(null);
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

  const streetAddress = savedAddress && !isWardApproxSavedAddress(savedAddress)
    ? savedAddress
    : null;
  const selectedWard = savedAddress && isWardApproxSavedAddress(savedAddress)
    ? savedAddress.replace(/^Near /, '')
    : null;
  const areaWard = getAreaWardFromSavedLocation();
  const effectiveDefaultWard = getDefaultWard();
  const hasSavedArea = Boolean(streetAddress || selectedWard);
  const showEstimateDropdown = !hasSavedArea || !useAreaWardDefault;
  const mapSummary = streetAddress ?? selectedWard ?? null;
  const estimateSummary = effectiveDefaultWard ?? 'Any ward';
  const hasArea = Boolean(mapSummary || effectiveDefaultWard);
  const manualDefaultLabel = storedDefaultWard ?? 'Any ward';

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setCandidates([]);
      setError(null);
      return;
    }

    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    setIsSearching(true);
    setError(null);

    try {
      const results = await searchDcAddressCandidates(trimmed);
      if (searchRequestId.current !== requestId) return;

      setCandidates(results);
      if (results.length === 0) {
        setError('No matches — add NE/NW/SE/SW or switch to ward.');
      }
    } catch {
      if (searchRequestId.current !== requestId) return;
      setCandidates([]);
      setError('Address search failed. Check your connection and try again.');
    } finally {
      if (searchRequestId.current === requestId) {
        setIsSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    const trimmed = addressInput.trim();
    if (inputMode !== 'address' || !trimmed || trimmed === streetAddress) {
      setCandidates([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [addressInput, streetAddress, inputMode, runSearch]);

  const handleSearchSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    void runSearch(addressInput);
  }, [addressInput, runSearch]);

  const handleSelectCandidate = useCallback((candidate: GeocodeCandidate) => {
    setSavedLocation({
      address: candidate.label,
      lat: candidate.lat,
      lon: candidate.lon,
      savedAt: Date.now(),
    });
    setSavedAddressState(candidate.label);
    setAddressInput(candidate.label);
    setInputMode('address');
    setCandidates([]);
    setError(null);
    resetEstimatePrefs();
    setStoredDefaultWardState(null);
    setUseAreaWardDefaultState(false);
    trackSavedLocationSet();
    refresh();
  }, [refresh]);

  const handleWardSelect = useCallback((ward: string) => {
    setCandidates([]);
    setError(null);

    if (!ward) {
      clearSavedLocation();
      setSavedAddressState(null);
      resetEstimatePrefs();
      setStoredDefaultWardState(null);
      setUseAreaWardDefaultState(false);
      return;
    }

    const center = getWardMapCenter(ward);
    if (!center) return;

    setSavedLocation({
      address: `Near ${ward}`,
      lat: center.lat,
      lon: center.lon,
      savedAt: Date.now(),
    });
    setSavedAddressState(`Near ${ward}`);
    setAddressInput('');
    setInputMode('ward');
    resetEstimatePrefs();
    setStoredDefaultWardState(null);
    setUseAreaWardDefaultState(false);
    trackSavedLocationSet();
    refresh();
  }, [refresh]);

  const handleInputModeChange = useCallback((mode: AreaInputMode) => {
    setInputMode(mode);
    setError(null);
    setCandidates([]);
  }, []);

  const handleUseAreaWardChange = useCallback((useAreaWard: boolean) => {
    setUseAddressWardDefault(useAreaWard);
    setUseAreaWardDefaultState(useAreaWard);
    if (useAreaWard) {
      setDefaultWard(null);
      setStoredDefaultWardState(null);
      trackDefaultWardSet('profile');
      return;
    }
    setStoredDefaultWardState(getStoredDefaultWard());
  }, []);

  const handleDefaultWardChange = useCallback((ward: string) => {
    setUseAddressWardDefault(false);
    setUseAreaWardDefaultState(false);
    setDefaultWard(ward || null);
    setStoredDefaultWardState(ward || null);
    if (ward) trackDefaultWardSet('profile');
  }, []);

  const handleClearArea = useCallback(() => {
    clearSavedLocation();
    resetEstimatePrefs();
    setAddressInput('');
    setSavedAddressState(null);
    setStoredDefaultWardState(null);
    setUseAreaWardDefaultState(false);
    setInputMode('address');
    setCandidates([]);
    setError(null);
  }, []);

  return (
    <div className="space-y-3">
      {hasArea && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3.5 py-2.5 flex items-start justify-between gap-3">
          <dl className="text-caption text-gray-700 space-y-1 mb-0 min-w-0">
            {mapSummary && (
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="text-gray-500 shrink-0">Area</dt>
                <dd className="font-medium text-gray-900 mb-0 truncate">{mapSummary}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-gray-500 shrink-0">Estimates</dt>
              <dd className="font-medium text-gray-900 mb-0">{estimateSummary}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleClearArea}
            className="shrink-0 text-xs text-blue-700 hover:text-blue-900 font-medium transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <div className={PROFILE_INSET_CLASS}>
        <section className={PROFILE_INSET_SECTION_CLASS}>
          <p className="text-caption font-medium text-gray-900 mb-0.5">Your area</p>
          <p className="text-xs text-gray-400 mb-3">Set a street address or ward for your map on Home.</p>

          <div
            className="flex rounded-md border border-border overflow-hidden mb-3"
            role="radiogroup"
            aria-label="Area input type"
          >
            <button
              type="button"
              role="radio"
              aria-checked={inputMode === 'address'}
              onClick={() => handleInputModeChange('address')}
              className={`flex-1 px-3 py-2 text-caption font-medium transition-colors ${
                inputMode === 'address'
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface hover:bg-gray-50 text-gray-700'
              }`}
            >
              Street address
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={inputMode === 'ward'}
              onClick={() => handleInputModeChange('ward')}
              className={`flex-1 px-3 py-2 text-caption font-medium border-l border-border transition-colors ${
                inputMode === 'ward'
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface hover:bg-gray-50 text-gray-700'
              }`}
            >
              Ward
            </button>
          </div>

          {inputMode === 'address' ? (
            <form onSubmit={handleSearchSubmit}>
              <label htmlFor="your-area-address" className={FIELD_LABEL_CLASS}>
                Street address
              </label>
              <div className="relative">
                <input
                  id="your-area-address"
                  type="text"
                  value={addressInput}
                  onChange={(event) => {
                    setAddressInput(event.target.value);
                    setError(null);
                  }}
                  placeholder="1234 H St NE"
                  className={`${SURFACE_INPUT_CLASS} ${isSearching ? 'pr-10' : ''}`}
                  autoComplete="street-address"
                  disabled={isSearching}
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
                    <SearchSpinner />
                  </div>
                )}
              </div>
              <span className="sr-only" aria-live="polite">
                {isSearching ? 'Searching addresses' : ''}
              </span>

              {!isSearching && candidates.length > 0 && (
                <ul
                  className="mt-2 border border-border rounded-md overflow-hidden divide-y divide-border shadow-sm"
                  role="listbox"
                  aria-label="Address matches"
                >
                  {candidates.map((candidate) => (
                    <li key={`${candidate.lat},${candidate.lon}`}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => handleSelectCandidate(candidate)}
                        className="w-full text-left px-3 py-2.5 text-caption text-gray-800 hover:bg-blue-50 transition-colors"
                      >
                        {candidate.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p className="text-caption text-amber-800 mt-1.5 mb-0">{error}</p>
              )}
            </form>
          ) : (
            <div>
              <label htmlFor="your-area-ward" className={FIELD_LABEL_CLASS}>
                Ward
              </label>
              <select
                id="your-area-ward"
                value={selectedWard ?? ''}
                onChange={(event) => handleWardSelect(event.target.value)}
                className={SURFACE_INPUT_CLASS}
              >
                <option value="">Select a ward</option>
                {WARD_ORDER.map((ward) => (
                  <option key={ward} value={ward}>{ward}</option>
                ))}
              </select>
              <p className={FIELD_HINT_CLASS}>Centers the Home map on this ward.</p>
            </div>
          )}
        </section>

        {hasSavedArea && areaWard && (
          <section className={PROFILE_INSET_SECTION_CLASS}>
            <p className="text-caption font-medium text-gray-900 mb-0.5">Check a request</p>
            <p className="text-xs text-gray-400 mb-3">Default ward when you open Estimate.</p>

            <div
              className="flex rounded-md border border-border overflow-hidden mb-2"
              role="radiogroup"
              aria-label="Default ward source"
            >
              <button
                type="button"
                role="radio"
                aria-checked={useAreaWardDefault}
                onClick={() => handleUseAreaWardChange(true)}
                className={`flex-1 px-3 py-2.5 text-left text-caption transition-colors ${
                  useAreaWardDefault
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="block font-medium">Use your area</span>
                <span className={`block text-[11px] mt-0.5 ${useAreaWardDefault ? 'text-blue-100' : 'text-gray-400'}`}>
                  {areaWard}
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!useAreaWardDefault}
                onClick={() => handleUseAreaWardChange(false)}
                className={`flex-1 px-3 py-2.5 text-left text-caption border-l border-border transition-colors ${
                  !useAreaWardDefault
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="block font-medium">Choose ward</span>
                <span className={`block text-[11px] mt-0.5 ${!useAreaWardDefault ? 'text-blue-100' : 'text-gray-400'}`}>
                  {manualDefaultLabel}
                </span>
              </button>
            </div>

            <div
              className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                showEstimateDropdown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden min-h-0">
                <label htmlFor="your-area-default-ward" className="sr-only">
                  Default ward
                </label>
                <select
                  id="your-area-default-ward"
                  value={storedDefaultWard ?? CITYWIDE_WARD_VALUE}
                  onChange={(event) => {
                    const ward = event.target.value;
                    handleDefaultWardChange(ward === CITYWIDE_WARD_VALUE ? '' : ward);
                  }}
                  className={SURFACE_INPUT_CLASS}
                  aria-hidden={!showEstimateDropdown}
                  tabIndex={showEstimateDropdown ? 0 : -1}
                >
                  <option value={CITYWIDE_WARD_VALUE}>Any ward (citywide)</option>
                  {WARD_ORDER.map((ward) => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {!hasSavedArea && (
          <section className={PROFILE_INSET_SECTION_CLASS}>
            <p className="text-caption font-medium text-gray-900 mb-0.5">Check a request</p>
            <p className="text-xs text-gray-400 mb-3">Default ward when you open Estimate.</p>
            <label htmlFor="your-area-default-ward" className={FIELD_LABEL_CLASS}>
              Default ward
            </label>
            <select
              id="your-area-default-ward"
              value={storedDefaultWard ?? CITYWIDE_WARD_VALUE}
              onChange={(event) => {
                const ward = event.target.value;
                handleDefaultWardChange(ward === CITYWIDE_WARD_VALUE ? '' : ward);
              }}
              className={SURFACE_INPUT_CLASS}
            >
              <option value={CITYWIDE_WARD_VALUE}>Any ward (citywide)</option>
              {WARD_ORDER.map((ward) => (
                <option key={ward} value={ward}>{ward}</option>
              ))}
            </select>
          </section>
        )}
      </div>
    </div>
  );
}
