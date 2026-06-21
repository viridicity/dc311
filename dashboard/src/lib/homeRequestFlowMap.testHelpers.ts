import type { Data } from 'plotly.js';
import {
  requestFlowHudAt,
  updateRequestFlowMarkers,
  type RequestFlowTimeline,
} from './homeRequestFlowMap';

export interface RequestFlowMapFrame {
  key: number;
  label: string;
  filedCount: number;
  resolvedCount: number;
  openCount: number;
  traces: Data[];
}

const WITHIN_DEADLINE_COLOR = '#2563EB';
const DEADLINE_GLOW_COLOR = 'rgb(230, 126, 34)';
const HOUR_MS = 3_600_000;

const REQUEST_FLOW_HOVER_TEMPLATE = (
  '<b>%{customdata[1]}</b><br>'
  + '%{customdata[0]}<br>'
  + '%{customdata[3]}<br>'
  + 'Ward: %{customdata[2]}<extra></extra>'
);

function createRequestFlowStaticTrace(timeline: RequestFlowTimeline): Data[] {
  const { displayPoints } = timeline;
  const lats = new Array<number>(displayPoints.length);
  const lons = new Array<number>(displayPoints.length);
  const customdata = new Array<[string, string, string, string]>(displayPoints.length);

  for (let index = 0; index < displayPoints.length; index += 1) {
    const point = displayPoints[index];
    lats[index] = point.lat;
    lons[index] = point.lon;
    customdata[index] = point.customdata;
  }

  const emptySizes = new Array<number>(displayPoints.length).fill(0);
  const emptyOpacities = new Array<number>(displayPoints.length).fill(0);

  return [
    {
      lat: lats,
      lon: lons,
      mode: 'markers',
      type: 'scattermap',
      name: 'Glow',
      uirevision: 'home-request-flow-glow',
      hoverinfo: 'skip',
      showlegend: false,
      marker: {
        symbol: 'circle',
        allowoverlap: true,
        size: emptySizes,
        color: new Array<string>(displayPoints.length).fill(DEADLINE_GLOW_COLOR),
        opacity: emptyOpacities,
      },
    } as Data,
    {
      lat: lats,
      lon: lons,
      mode: 'markers',
      type: 'scattermap',
      name: 'Requests',
      uirevision: 'home-request-flow',
      hoverinfo: 'all',
      marker: {
        symbol: 'circle',
        allowoverlap: true,
        size: emptySizes,
        color: new Array<string>(displayPoints.length).fill(WITHIN_DEADLINE_COLOR),
        opacity: new Array<number>(displayPoints.length).fill(1),
      },
      customdata,
      hovertemplate: REQUEST_FLOW_HOVER_TEMPLATE,
    } as Data,
  ];
}

/** Builds one map frame from a continuous playhead — test helper for the legacy Plotly path. */
export function buildRequestFlowFrame(
  timeline: RequestFlowTimeline,
  playheadMs: number,
): RequestFlowMapFrame {
  const sizes = new Array<number>(timeline.displayPoints.length);
  const colors = new Array<string>(timeline.displayPoints.length);
  const opacities = new Array<number>(timeline.displayPoints.length);
  const customdata = new Array<[string, string, string, string]>(timeline.displayPoints.length);
  updateRequestFlowMarkers(
    timeline,
    playheadMs,
    sizes,
    colors,
    opacities,
    customdata,
  );

  const hud = requestFlowHudAt(timeline, playheadMs);
  const traces = createRequestFlowStaticTrace(timeline);
  const glowTrace = traces[0] as Data & {
    marker?: { size?: number[]; color?: string[]; opacity?: number[] };
  };
  const mainTrace = traces[1] as Data & {
    marker?: { size?: number[]; color?: string[]; opacity?: number[] };
    customdata?: [string, string, string, string][];
  };
  if (glowTrace.marker) {
    glowTrace.marker.size = sizes.map(() => 0);
    glowTrace.marker.opacity = sizes.map(() => 0);
  }
  if (mainTrace.marker) {
    mainTrace.marker.size = sizes;
    mainTrace.marker.color = colors;
    mainTrace.marker.opacity = opacities;
  }
  mainTrace.customdata = customdata;

  return {
    key: timeline.startMs + hud.hourIndex * HOUR_MS,
    label: hud.label,
    filedCount: hud.filedCount,
    resolvedCount: hud.resolvedCount,
    openCount: hud.openCount,
    traces,
  };
}

/** Counts display slots that actually render a marker at this playhead. */
export function visibleDisplayCountAt(timeline: RequestFlowTimeline, playheadMs: number): number {
  const sizes = new Array<number>(timeline.displayPoints.length);
  const colors = new Array<string>(timeline.displayPoints.length);
  const opacities = new Array<number>(timeline.displayPoints.length);
  const customdata = new Array<[string, string, string, string]>(timeline.displayPoints.length);
  updateRequestFlowMarkers(
    timeline,
    playheadMs,
    sizes,
    colors,
    opacities,
    customdata,
  );
  let count = 0;
  for (let index = 0; index < sizes.length; index += 1) {
    if (sizes[index] > 0) count += 1;
  }
  return count;
}
