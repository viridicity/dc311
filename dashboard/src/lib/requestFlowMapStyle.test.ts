import { describe, expect, it } from 'vitest';
import {
  lookupWardFromCoordinates,
  resolveRequestFlowMapView,
  WARD_MAP_CENTERS,
} from './requestFlowMapStyle';

describe('resolveRequestFlowMapView', () => {
  it('uses citywide defaults without a saved location', () => {
    const view = resolveRequestFlowMapView(null, false);
    expect(view.zoom).toBeGreaterThan(10);
    expect(view.lat).toBeGreaterThan(38.8);
  });

  it('zooms closer when a saved location exists', () => {
    const citywide = resolveRequestFlowMapView(null, false);
    const localized = resolveRequestFlowMapView({ lat: 38.9, lon: -77.0 }, false);
    expect(localized.zoom).toBeGreaterThan(citywide.zoom);
    expect(localized.lat).toBe(38.9);
    expect(localized.lon).toBe(-77.0);
  });

  it('maps geocoded coordinates to the nearest ward center', () => {
    const ward = lookupWardFromCoordinates(38.9098, -77.0174);
    expect(ward).toBe('Ward 1');
    expect(WARD_MAP_CENTERS[ward!]).toBeDefined();
  });
});
