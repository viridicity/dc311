import type { Map as MaplibreMap } from 'maplibre-gl';
import type { RequestFlowGeometry, RequestFlowSpatialIndex } from './requestFlowGeometry';
import { querySpatialIndex } from './requestFlowGeometry';
import {
  getRequestFlowSpriteCanvases,
  REQUEST_FLOW_ASCII_FONT,
  requestFlowAsciiChar,
} from './requestFlowCategoryShapes';
import type { RequestFlowMarkerBuffers } from './requestFlowMapLayers';
import {
  markerScreenRadiusFromMpp,
  metersPerPixel,
} from './requestFlowMarkerScale';
import { mapTransformKey, projectLonLatBatch } from './requestFlowProjection';

const HIT_CELL_PX = 28;
/** Hard cap on drawn markers — visual decimation when over budget, not data subsampling. */
export const REQUEST_FLOW_RENDER_BUDGET = 80_000;
const SIMPLE_DOT_VISIBLE_LIMIT = 28_000;
const WITHIN_COLOR = '#2563EB';
const PAST_COLOR = '#e67e22';

/** Canvas markers with spatial indexing and a render budget for 100k+ points. */
export class RequestFlowCanvasOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hitCells = new Map<number, number[]>();
  private readonly viewportScratch: number[] = [];
  private readonly drawScratch: number[] = [];
  private readonly cellPick = new Uint8Array(REQUEST_FLOW_RENDER_BUDGET);
  private hitRevision = -1;
  private lastTransformKey = '';
  private lastMetersPerPixel = 1;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'request-flow-canvas-overlay';
    this.canvas.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('request-flow-canvas-overlay: 2d context unavailable');
    }
    this.ctx = ctx;
  }

  destroy(): void {
    this.canvas.remove();
  }

  paint(
    map: MaplibreMap,
    geometry: RequestFlowGeometry,
    spatialIndex: RequestFlowSpatialIndex,
    buffers: RequestFlowMarkerBuffers,
    wiggleHidden?: ReadonlySet<number>,
  ): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const cssWidth = parent.clientWidth;
    const cssHeight = parent.clientHeight;
    if (cssWidth <= 0 || cssHeight <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
      this.lastTransformKey = '';
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, cssWidth, cssHeight);

    const transformKey = mapTransformKey(map);
    const reprojectAll = transformKey !== this.lastTransformKey;
    if (reprojectAll) {
      this.lastTransformKey = transformKey;
    }

    const bounds = map.getBounds();
    querySpatialIndex(
      spatialIndex,
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
      this.viewportScratch,
    );

    const drawList = this.buildDrawList(geometry, buffers, wiggleHidden, this.viewportScratch);
    this.lastMetersPerPixel = metersPerPixel(map.getCenter().lat, map.getZoom());
    projectLonLatBatch(
      map,
      geometry.lon,
      geometry.lat,
      drawList,
      buffers.screenX,
      buffers.screenY,
      buffers.screenValid,
      reprojectAll,
    );

    this.hitCells.clear();
    const useSimpleGlyphs = drawList.length > SIMPLE_DOT_VISIBLE_LIMIT;
    const sprites = useSimpleGlyphs ? null : getRequestFlowSpriteCanvases();
    const { screenX, screenY, sizes, opacities, spriteKeyIndices, pastDue } = buffers;
    if (useSimpleGlyphs) {
      this.ctx.font = REQUEST_FLOW_ASCII_FONT;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
    }

    for (let listIndex = 0; listIndex < drawList.length; listIndex += 1) {
      const index = drawList[listIndex];
      const normalizedRadius = sizes[index];
      if (normalizedRadius <= 0) continue;
      const opacity = opacities[index];
      if (opacity <= 0) continue;

      const screenRadius = markerScreenRadiusFromMpp(
        this.lastMetersPerPixel,
        normalizedRadius,
      );
      if (screenRadius <= 0) continue;

      const px = screenX[index];
      const py = screenY[index];
      if (
        px < -screenRadius * 2
        || py < -screenRadius * 2
        || px > cssWidth + screenRadius * 2
        || py > cssHeight + screenRadius * 2
      ) {
        continue;
      }

      const diameter = screenRadius * 2;
      if (useSimpleGlyphs) {
        this.ctx.globalAlpha = opacity;
        this.ctx.fillStyle = pastDue[index] ? PAST_COLOR : WITHIN_COLOR;
        const fontPx = Math.max(7, diameter * 0.92);
        this.ctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        this.ctx.fillText(requestFlowAsciiChar(spriteKeyIndices[index] >> 1), px, py + 0.5);
      } else {
        const sprite = sprites![spriteKeyIndices[index]];
        if (!sprite) continue;
        this.ctx.globalAlpha = opacity;
        this.ctx.drawImage(sprite, px - diameter / 2, py - diameter / 2, diameter, diameter);
      }

      const cellKey = packCellKey(Math.floor(px / HIT_CELL_PX), Math.floor(py / HIT_CELL_PX));
      let bucket = this.hitCells.get(cellKey);
      if (!bucket) {
        bucket = [];
        this.hitCells.set(cellKey, bucket);
      }
      bucket.push(index);
    }

    this.ctx.globalAlpha = 1;
    buffers.paintRevision += 1;
    this.hitRevision = buffers.paintRevision;
  }

  hitTest(buffers: RequestFlowMarkerBuffers, x: number, y: number): number | null {
    if (this.hitRevision !== buffers.paintRevision) return null;

    const cellX = Math.floor(x / HIT_CELL_PX);
    const cellY = Math.floor(y / HIT_CELL_PX);
    let bestIndex: number | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const bucket = this.hitCells.get(packCellKey(cellX + dx, cellY + dy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i += 1) {
          const index = bucket[i];
          const normalizedRadius = buffers.sizes[index];
          if (normalizedRadius <= 0 || buffers.opacities[index] <= 0) continue;
          const hitRadius = markerScreenRadiusFromMpp(this.lastMetersPerPixel, normalizedRadius) + 2;
          const distSq = (buffers.screenX[index] - x) ** 2 + (buffers.screenY[index] - y) ** 2;
          if (distSq <= hitRadius * hitRadius && distSq < bestDistSq) {
            bestDistSq = distSq;
            bestIndex = index;
          }
        }
      }
    }
    return bestIndex;
  }

  private buildDrawList(
    geometry: RequestFlowGeometry,
    buffers: RequestFlowMarkerBuffers,
    wiggleHidden: ReadonlySet<number> | undefined,
    viewportCandidates: readonly number[],
  ): number[] {
    const drawList = this.drawScratch;
    drawList.length = 0;
    this.cellPick.fill(0);

    const { visibleIndexSlots, sizes, opacities, visibleIndices } = buffers;
    const overBudget = visibleIndices.length > REQUEST_FLOW_RENDER_BUDGET;

    const tryPush = (index: number) => {
      if (visibleIndexSlots[index] < 0) return;
      if (wiggleHidden?.has(index)) return;
      if (sizes[index] <= 0 || opacities[index] <= 0) return;
      if (overBudget) {
        const cell = spatialCellKey(geometry.lon[index], geometry.lat[index]);
        const slot = cell % this.cellPick.length;
        if (this.cellPick[slot]) return;
        this.cellPick[slot] = 1;
      }
      drawList.push(index);
    };

    for (let i = 0; i < viewportCandidates.length && drawList.length < REQUEST_FLOW_RENDER_BUDGET; i += 1) {
      tryPush(viewportCandidates[i]);
    }

    if (drawList.length < REQUEST_FLOW_RENDER_BUDGET && !overBudget) {
      for (let i = 0; i < visibleIndices.length && drawList.length < REQUEST_FLOW_RENDER_BUDGET; i += 1) {
        tryPush(visibleIndices[i]);
      }
    }

    return drawList;
  }
}

function spatialCellKey(lon: number, lat: number): number {
  return (Math.floor(lon * 10_000) & 0xffff) | ((Math.floor(lat * 10_000) & 0xffff) << 16);
}

function packCellKey(cellX: number, cellY: number): number {
  return ((cellX + 8192) << 14) | (cellY + 8192);
}
