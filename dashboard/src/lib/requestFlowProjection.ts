import type { Map as MaplibreMap } from 'maplibre-gl';

/** Projects lon/lat arrays through the map without per-point wrapper overhead. */
export function projectLonLatBatch(
  map: MaplibreMap,
  lon: Float32Array,
  lat: Float32Array,
  indices: readonly number[],
  screenX: Float32Array,
  screenY: Float32Array,
  screenValid: Uint8Array,
  reprojectAll: boolean,
): void {
  for (let listIndex = 0; listIndex < indices.length; listIndex += 1) {
    const index = indices[listIndex];
    if (!reprojectAll && screenValid[index] === 1) continue;
    const projected = map.project([lon[index], lat[index]]);
    screenX[index] = projected.x;
    screenY[index] = projected.y;
    screenValid[index] = 1;
  }
}

export function mapTransformKey(map: MaplibreMap): string {
  const center = map.getCenter();
  const container = map.getContainer();
  return `${center.lng},${center.lat},${map.getZoom()},${map.getBearing()},${map.getPitch()},${container.clientWidth},${container.clientHeight}`;
}
