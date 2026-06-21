import { trackHomeHandoffToEstimate } from './analytics';
import { buildEstimateSearchParams, EstimateUrlState } from './estimateData';
import { TabId } from './tabIds';

export const ESTIMATE_HANDOFF_SCROLL_KEY = 'dc311_estimate_handoff_scroll';

export type EstimateHandoffSource =
  | 'home_ticket'
  | 'home_cta'
  | 'home_quick_pick'
  | 'recent_lookup'
  | 'subscribed_ticket';

/** Applies estimate URL state and switches tabs without an empty-state flash. */
export function handoffToEstimate(
  state: EstimateUrlState,
  setActiveTab: (tab: TabId) => void,
  source: EstimateHandoffSource,
): void {
  const params = buildEstimateSearchParams(state);
  const next = `${window.location.pathname}?${params.toString()}`;
  try {
    sessionStorage.setItem(ESTIMATE_HANDOFF_SCROLL_KEY, '1');
  } catch {
    // Ignore storage errors.
  }
  window.history.pushState(null, '', next);
  trackHomeHandoffToEstimate(source);
  setActiveTab('estimate');
}
