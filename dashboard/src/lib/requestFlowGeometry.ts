import type { FlowDisplayPoint } from './homeRequestFlowMap';
import { REQUEST_FLOW_MAP_BOUNDS } from './requestFlowMapStyle';

/** Columnar geometry — lat/lon columns for projection and spatial indexing. */
export interface RequestFlowGeometry {
  count: number;
  lat: Float32Array;
  lon: Float32Array;
  shapeIndex: Uint8Array;
}

/** Uniform grid over the dataset bbox for O(viewport) queries. */
export interface RequestFlowSpatialIndex {
  cols: number;
  rows: number;
  west: number;
  south: number;
  east: number;
  north: number;
  /** Prefix sum into cellIndices; length cols * rows + 1. */
  cellOffsets: Uint32Array;
  cellIndices: Uint32Array;
}

const DEFAULT_GRID_COLS = 128;
const DEFAULT_GRID_ROWS = 128;

/** Packs display points into typed columns for hot-loop access. */
export function buildRequestFlowGeometry(displayPoints: FlowDisplayPoint[]): RequestFlowGeometry {
  const count = displayPoints.length;
  const lat = new Float32Array(count);
  const lon = new Float32Array(count);
  const shapeIndex = new Uint8Array(count);

  for (let index = 0; index < count; index += 1) {
    const point = displayPoints[index];
    lat[index] = point.lat;
    lon[index] = point.lon;
    shapeIndex[index] = point.shapeIndex;
  }

  return { count, lat, lon, shapeIndex };
}

/** Builds a flat uniform grid — total storage O(point count). */
export function buildRequestFlowSpatialIndex(
  geometry: RequestFlowGeometry,
  cols = DEFAULT_GRID_COLS,
  rows = DEFAULT_GRID_ROWS,
): RequestFlowSpatialIndex {
  const { west, east, south, north } = REQUEST_FLOW_MAP_BOUNDS;
  const cellCount = cols * rows;
  const cellSizes = new Uint32Array(cellCount);

  for (let index = 0; index < geometry.count; index += 1) {
    const cell = cellForLonLat(
      geometry.lon[index],
      geometry.lat[index],
      west,
      south,
      east,
      north,
      cols,
      rows,
    );
    if (cell >= 0) cellSizes[cell] += 1;
  }

  const cellOffsets = new Uint32Array(cellCount + 1);
  for (let cell = 0; cell < cellCount; cell += 1) {
    cellOffsets[cell + 1] = cellOffsets[cell] + cellSizes[cell];
  }

  const cellIndices = new Uint32Array(geometry.count);
  const cellWrite = new Uint32Array(cellCount);
  for (let index = 0; index < geometry.count; index += 1) {
    const cell = cellForLonLat(
      geometry.lon[index],
      geometry.lat[index],
      west,
      south,
      east,
      north,
      cols,
      rows,
    );
    if (cell < 0) continue;
    const writeAt = cellOffsets[cell] + cellWrite[cell];
    cellIndices[writeAt] = index;
    cellWrite[cell] += 1;
  }

  return { cols, rows, west, south, east, north, cellOffsets, cellIndices };
}

/** Lists point indices whose grid cells overlap a geographic bounding box. */
export function querySpatialIndex(
  index: RequestFlowSpatialIndex,
  west: number,
  south: number,
  east: number,
  north: number,
  out: number[],
): number {
  out.length = 0;
  const colMin = Math.max(0, Math.floor(((west - index.west) / (index.east - index.west)) * index.cols));
  const colMax = Math.min(index.cols - 1, Math.floor(((east - index.west) / (index.east - index.west)) * index.cols));
  const rowMin = Math.max(0, Math.floor(((south - index.south) / (index.north - index.south)) * index.rows));
  const rowMax = Math.min(index.rows - 1, Math.floor(((north - index.south) / (index.north - index.south)) * index.rows));

  for (let row = rowMin; row <= rowMax; row += 1) {
    for (let col = colMin; col <= colMax; col += 1) {
      const cell = row * index.cols + col;
      const start = index.cellOffsets[cell];
      const end = index.cellOffsets[cell + 1];
      for (let at = start; at < end; at += 1) {
        out.push(index.cellIndices[at]);
      }
    }
  }
  return out.length;
}

function cellForLonLat(
  lon: number,
  lat: number,
  west: number,
  south: number,
  east: number,
  north: number,
  cols: number,
  rows: number,
): number {
  if (lon < west || lon > east || lat < south || lat > north) return -1;
  const col = Math.min(cols - 1, Math.max(0, Math.floor(((lon - west) / (east - west)) * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(((lat - south) / (north - south)) * rows)));
  return row * cols + col;
}
