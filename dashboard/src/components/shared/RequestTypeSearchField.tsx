import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  looksLikeTicketId,
  searchServiceTypes,
  ServiceTypeSearchGroup,
} from '../../lib/estimateData';
import { trackEstimateSearch, type EstimateSearchSource } from '../../lib/analytics';

interface RequestTypeSearchFieldProps {
  serviceTypes: string[];
  categoryMap: Record<string, string>;
  inputId: string;
  placeholder?: string;
  onServiceTypeSelect: (serviceType: string, source: EstimateSearchSource) => void;
  onTicketSubmit: (ticketId: string) => void;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-100 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function flattenGroups(groups: ServiceTypeSearchGroup[]): string[] {
  const flat: string[] = [];
  for (const group of groups) {
    for (const type of group.types) flat.push(type);
  }
  return flat;
}

/** Searchable request-type combobox — opens the full categorized list on focus. */
export default function RequestTypeSearchField({
  serviceTypes,
  categoryMap,
  inputId,
  placeholder = 'Search by request type or paste a ticket number',
  onServiceTypeSelect,
  onTicketSubmit,
}: RequestTypeSearchFieldProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isTicketMode = looksLikeTicketId(query);
  const dropdownQuery = browseAll && open ? '' : query;

  const searchGroups = useMemo(() => {
    if (isTicketMode) return [];
    return searchServiceTypes(dropdownQuery, serviceTypes, categoryMap);
  }, [dropdownQuery, serviceTypes, categoryMap, isTicketMode]);

  const flatItems = useMemo(() => flattenGroups(searchGroups), [searchGroups]);
  const totalResults = flatItems.length;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, browseAll]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelectType = useCallback((type: string, source: EstimateSearchSource) => {
    setQuery(type);
    setBrowseAll(false);
    onServiceTypeSelect(type, source);
    trackEstimateSearch(source, false);
    setOpen(false);
  }, [onServiceTypeSelect]);

  const handleSubmit = useCallback(() => {
    if (open && activeIndex >= 0 && activeIndex < flatItems.length) {
      handleSelectType(flatItems[activeIndex], 'typeahead');
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) return;
    if (looksLikeTicketId(trimmed)) {
      onTicketSubmit(trimmed);
      setOpen(false);
      return;
    }
    if (searchGroups.length === 1 && searchGroups[0].types.length === 1) {
      handleSelectType(searchGroups[0].types[0], 'typeahead');
    }
  }, [activeIndex, flatItems, handleSelectType, onTicketSubmit, open, query, searchGroups]);

  const handleClear = useCallback(() => {
    setQuery('');
    setActiveIndex(-1);
    setBrowseAll(true);
    setOpen(true);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open && flatItems.length > 0) {
        setBrowseAll(!query.trim());
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : prev));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }, [flatItems.length, handleSubmit, open, query]);

  const showDropdown = open && searchGroups.length > 0;
  const hasQuery = query.trim().length > 0;
  const activeDescendant = activeIndex >= 0 && activeIndex < flatItems.length
    ? `${listId}-opt-${activeIndex}`
    : undefined;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="sr-only">
        Request type or ticket number
      </label>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-activedescendant={activeDescendant}
          autoComplete="off"
          placeholder={placeholder}
          className="w-full text-body border border-border rounded-md pl-9 pr-8 py-2 min-h-[44px] bg-surface focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setBrowseAll(false);
            setOpen(!looksLikeTicketId(next));
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (looksLikeTicketId(query)) return;
            setBrowseAll(!query.trim());
            setOpen(true);
          }}
        />
        {hasQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-text-muted hover:text-gray-900 hover:bg-surface-muted transition-colors"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {isTicketMode && hasQuery && (
        <p className="mt-1.5 text-caption text-blue-700 mb-0 flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Ticket number detected — press Enter to check it
        </p>
      )}
      {showDropdown && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-surface border border-border rounded-md shadow-lg scrollbar-thin"
        >
          <li className="px-3 py-1.5 text-caption text-text-muted border-b border-border bg-surface" aria-hidden="true">
            {browseAll && !dropdownQuery.trim()
              ? `${totalResults} request types`
              : `${totalResults} result${totalResults !== 1 ? 's' : ''}`}
          </li>
          {searchGroups.map((group) => (
            <li key={group.category} role="group" aria-label={group.category}>
              <div className="px-3 py-1.5 text-caption font-semibold text-text-muted bg-surface-muted flex items-center justify-between">
                <span>{group.category}</span>
                <span className="text-caption tabular-nums font-normal">{group.types.length}</span>
              </div>
              <ul role="presentation">
                {group.types.map((type) => {
                  const flatIdx = flatItems.indexOf(type);
                  const isActive = flatIdx === activeIndex;
                  return (
                    <li key={type}>
                      <button
                        id={`${listId}-opt-${flatIdx}`}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        className={`w-full text-left px-3 py-2 text-body min-h-[44px] transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-900'
                            : 'hover:bg-surface-muted'
                        }`}
                        onClick={() => handleSelectType(type, 'typeahead')}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                      >
                        <HighlightMatch text={type} query={dropdownQuery.trim()} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
