import type { Map as MaplibreMap } from 'maplibre-gl';
import { REQUEST_FLOW_MAP_CENTER, REQUEST_FLOW_MAP_ZOOM } from './requestFlowMapStyle';
import { REQUEST_FLOW_MARKER_RADIUS_PX } from './requestFlowCategoryShapes';

/** Web Mercator meters per pixel at a latitude and zoom level. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Scales on-map footprint vs the legacy 6px reference — ASCII glyphs read smaller. */
export const REQUEST_FLOW_MARKER_GROUND_SCALE = 0.15;

/** Ground radius at the default desktop zoom after REQUEST_FLOW_MARKER_GROUND_SCALE. */
export const REQUEST_FLOW_MARKER_GROUND_RADIUS_M =
  REQUEST_FLOW_MARKER_RADIUS_PX
  * metersPerPixel(REQUEST_FLOW_MAP_CENTER.lat, REQUEST_FLOW_MAP_ZOOM.desktop)
  * REQUEST_FLOW_MARKER_GROUND_SCALE;

/** Converts normalized marker radius (0..REQUEST_FLOW_MARKER_RADIUS_PX) to screen pixels. */
export function markerScreenRadiusFromMpp(mpp: number, normalizedRadius: number): number {
  if (normalizedRadius <= 0 || mpp <= 0) return 0;
  const groundRadius =
    REQUEST_FLOW_MARKER_GROUND_RADIUS_M * (normalizedRadius / REQUEST_FLOW_MARKER_RADIUS_PX);
  return groundRadius / mpp;
}

/** Screen radius for a marker at the current map zoom. */
export function markerScreenRadius(
  map: MaplibreMap,
  lat: number,
  normalizedRadius: number,
): number {
  return markerScreenRadiusFromMpp(metersPerPixel(lat, map.getZoom()), normalizedRadius);
}
