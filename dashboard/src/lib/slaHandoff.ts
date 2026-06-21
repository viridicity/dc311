import { SlaFilterState } from './filterTypes';

export type PendingSlaFilters = Partial<Pick<SlaFilterState, 'categories' | 'serviceTypes' | 'wards'>>;

let pendingSlaFilters: PendingSlaFilters | null = null;

export function setPendingSlaFilters(filters: PendingSlaFilters): void {
  pendingSlaFilters = filters;
}

export function consumePendingSlaFilters(): PendingSlaFilters | null {
  const filters = pendingSlaFilters;
  pendingSlaFilters = null;
  return filters;
}
