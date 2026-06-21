import type { RequestFlowTimeline } from './homeRequestFlowMap';

export const REQUEST_FLOW_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

export interface RequestFlowMarkerBuffers {
  sizes: number[];
  colors: string[];
  opacities: number[];
  customdata: [string, string, string, string][];
  /** Indices with size > 0 and opacity > 0 — canvas draws only this list. */
  visibleIndices: number[];
  /** Position in visibleIndices, or -1 when hidden. */
  visibleIndexSlots: Int32Array;
  /** O(1) sprite lookup — updated when marker color changes. */
  spriteKeyIndices: Uint8Array;
  /** Cached screen coords — reused across playhead frames until map moves. */
  screenX: Float32Array;
  screenY: Float32Array;
  /** 0 = screenX/Y stale for this index; set when a marker becomes visible. */
  screenValid: Uint8Array;
  /** Bumped after each canvas paint for hit-test cache invalidation. */
  paintRevision: number;
  /** 0 = within deadline, 1 = past due — hot-path color flag. */
  pastDue: Uint8Array;
  /** Scratch bitmap for active-index unions without Set allocation. */
  activeScratch?: Uint8Array;
}

/** Allocates marker buffers and visibility tracking for a timeline. */
export function createRequestFlowMarkerBuffers(
  timeline: RequestFlowTimeline,
): RequestFlowMarkerBuffers {
  const pointCount = timeline.displayPoints.length;
  return {
    sizes: new Array<number>(pointCount),
    colors: new Array<string>(pointCount),
    opacities: new Array<number>(pointCount),
    customdata: timeline.displayPoints.map((point) => [...point.customdata]),
    visibleIndices: [],
    visibleIndexSlots: new Int32Array(pointCount).fill(-1),
    spriteKeyIndices: new Uint8Array(pointCount),
    screenX: new Float32Array(pointCount),
    screenY: new Float32Array(pointCount),
    screenValid: new Uint8Array(pointCount),
    paintRevision: 0,
    pastDue: new Uint8Array(pointCount),
    activeScratch: new Uint8Array(pointCount),
  };
}

export function formatRequestFlowHoverHtml(
  customdata: [string, string, string, string],
): string {
  return (
    `<span class="request-flow-map-tooltip__title">${escapeHtml(customdata[1])}</span>`
    + `<span class="request-flow-map-tooltip__line">${escapeHtml(customdata[0])}</span>`
    + `<span class="request-flow-map-tooltip__line">${escapeHtml(customdata[3])}</span>`
    + `<span class="request-flow-map-tooltip__line">Ward: ${escapeHtml(customdata[2])}</span>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
