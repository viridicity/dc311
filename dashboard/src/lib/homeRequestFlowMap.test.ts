import { describe, expect, it } from 'vitest';
import {
  activeIndicesForPlayhead,
  activeIndicesForPlayheadStep,
  advanceRequestFlowOverlaySessions,
  collectRequestFlowWiggleDots,
  createRequestFlowOverlaySessions,
  DEADLINE_COCOON_MORPH_MS,
  DEADLINE_POST_DUE_OVERLAY_MS,
  DEADLINE_WIGGLE_SETTLE_MS,
  FADE_OUT_HOURS,
  hourIndexAt,
  openCountAtPlayhead,
  markerColorAtPlayhead,
  pastDeadlineAtPlayhead,
  playheadFromHourIndex,
  prepareRequestFlowTimeline,
  REQUEST_FLOW_HOUR_MS,
  RequestFlowTimeline,
  SIM_MS_PER_REAL_MS,
  updateRequestFlowMarkers,
  type RequestFlowOverlaySessions,
} from './homeRequestFlowMap';
import { buildRequestFlowFrame, visibleDisplayCountAt } from './homeRequestFlowMap.testHelpers';
import { ProcessedRequest } from './dataProcessing';
import { REQUEST_FLOW_MARKER_RADIUS_PX } from './requestFlowCategoryShapes';
import { colors } from './theme';

const MARKER_SIZE = REQUEST_FLOW_MARKER_RADIUS_PX;

const HOUR_MS = 3_600_000;
const MAIN_TRACE = 1;

function markerBuffers(length: number) {
  return {
    sizes: new Array<number>(length),
    colors: new Array<string>(length),
    opacities: new Array<number>(length),
    customdata: new Array<[string, string, string, string]>(length),
    visibleIndices: [] as number[],
    visibleIndexSlots: new Int32Array(length).fill(-1),
    spriteKeyIndices: new Uint8Array(length),
    screenX: new Float32Array(length),
    screenY: new Float32Array(length),
    screenValid: new Uint8Array(length),
    paintRevision: 0,
    pastDue: new Uint8Array(length),
    activeScratch: new Uint8Array(length),
  };
}

function callUpdateMarkers(
  timeline: RequestFlowTimeline,
  playheadMs: number,
  buffers: ReturnType<typeof markerBuffers>,
  culled: Uint8Array | undefined,
  clock?: {
    phaseMs?: number;
    playing?: boolean;
    previousPlayheadMs?: number;
    overlaySessions?: RequestFlowOverlaySessions;
  },
  scope: 'all' | 'active' = 'all',
  previousPlayheadMs?: number,
) {
  return updateRequestFlowMarkers(
    timeline,
    playheadMs,
    buffers.sizes,
    buffers.colors,
    buffers.opacities,
    buffers.customdata,
    culled,
    clock ? {
      phaseMs: clock.phaseMs ?? 0,
      playing: clock.playing ?? false,
      previousPlayheadMs: clock.previousPlayheadMs,
      overlaySessions: clock.overlaySessions,
    } : undefined,
    scope,
    previousPlayheadMs,
    buffers,
  );
}

function seedOverlaySession(
  timeline: RequestFlowTimeline,
  index: number,
  options: {
    sessionStartMs: number;
    dueCrossedRealMs?: number;
    lockedRadius?: number;
    frozenPlayheadMs: number;
  },
): RequestFlowOverlaySessions {
  const sessions = createRequestFlowOverlaySessions(timeline.displayPoints.length);
  sessions.sessionStartMs[index] = options.sessionStartMs;
  sessions.dueCrossedRealMs[index] = options.dueCrossedRealMs ?? 0;
  sessions.lockedRadius[index] = options.lockedRadius ?? MARKER_SIZE;
  sessions.frozenPlayheadMs[index] = options.frozenPlayheadMs;
  return sessions;
}

function updateWithPulse(
  timeline: RequestFlowTimeline,
  playheadMs: number,
  buffers: ReturnType<typeof markerBuffers>,
  options: {
    phaseMs?: number;
    playing?: boolean;
    previousPlayheadMs?: number;
    overlaySessions?: RequestFlowOverlaySessions;
  } = {},
) {
  const overlaySessions = options.overlaySessions
    ?? createRequestFlowOverlaySessions(timeline.displayPoints.length);
  if (options.playing) {
    advanceRequestFlowOverlaySessions(
      timeline,
      playheadMs,
      buffers.sizes,
      {
        phaseMs: options.phaseMs ?? 0,
        playing: true,
        overlaySessions,
      },
    );
  }
  callUpdateMarkers(
    timeline,
    playheadMs,
    buffers,
    undefined,
    {
      phaseMs: options.phaseMs ?? 0,
      playing: options.playing ?? false,
      previousPlayheadMs: options.previousPlayheadMs,
      overlaySessions,
    },
  );
  return overlaySessions;
}

function makeRow(overrides: Partial<ProcessedRequest> & { date: Date }): ProcessedRequest {
  return {
    SERVICEREQUESTID: '1',
    ADDDATE: overrides.date.toISOString(),
    RESOLUTIONDATE: null,
    SERVICEDUEDATE: null,
    SERVICEORDERDATE: null,
    INSPECTIONDATE: null,
    CREATED: null,
    EDITED: null,
    SERVICECODE: 1,
    SERVICECODEDESCRIPTION: 'Pothole',
    SERVICETYPECODEDESCRIPTION: null,
    ORGANIZATIONACRONYM: null,
    SERVICEORDERSTATUS: 'Open',
    STATUS_CODE: null,
    PRIORITY: null,
    SERVICECALLCOUNT: null,
    INSPECTIONFLAG: null,
    INSPECTORNAME: null,
    STREETADDRESS: '123 Main St',
    CITY: 'Washington',
    STATE: 'DC',
    ZIPCODE: '20001',
    DETAILS: null,
    WARD: 'Ward 1',
    LATITUDE: 38.9,
    LONGITUDE: -77.03,
    week: overrides.date,
    hour: 12,
    dayOfWeek: 'Monday',
    category: 'Roads',
    is_open: true,
    is_closed: false,
    age_days: 3,
    resolution_days: null,
    age_bucket: '< 1 week',
    ...overrides,
  };
}

function toResolutionString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
  );
}

describe('prepareRequestFlowTimeline', () => {
  it('keeps requests visible for at least 24 hours after filing', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const resolved = new Date('2024-06-10T14:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({ date: filed, RESOLUTIONDATE: toResolutionString(resolved) }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const beforeFadeHour = hourIndexAt(
      timeline,
      new Date('2024-06-11T11:00:00Z').setMinutes(0, 0, 0),
    );
    const beforeFade = playheadFromHourIndex(timeline, beforeFadeHour);
    const fadeStart = point.fadeStartHour!;
    const midFade = fadeStart + (FADE_OUT_HOURS / 2) * HOUR_MS;
    const fadeEnd = fadeStart + FADE_OUT_HOURS * HOUR_MS;

    const beforeFadeFrame = buildRequestFlowFrame(timeline, beforeFade);
    const midFadeFrame = buildRequestFlowFrame(timeline, midFade);
    const fadeEndFrame = buildRequestFlowFrame(timeline, fadeEnd + 1);
    const beforeSize = (beforeFadeFrame.traces[MAIN_TRACE] as { marker?: { size?: number[] } }).marker?.size?.[0];
    const midSize = (midFadeFrame.traces[MAIN_TRACE] as { marker?: { size?: number[] } }).marker?.size?.[0];
    const fadeEndSize = (fadeEndFrame.traces[MAIN_TRACE] as { marker?: { size?: number[] } }).marker?.size?.[0];
    expect(beforeSize).toBeGreaterThan(0);
    expect(midSize).toBeLessThan(beforeSize!);
    expect(fadeEndSize).toBe(0);
    expect(buildRequestFlowFrame(timeline, beforeFade).openCount).toBe(1);
    expect(buildRequestFlowFrame(timeline, fadeEnd + 1).openCount).toBe(0);
  });

  it('returns hasData false when no coordinates exist', () => {
    const result = prepareRequestFlowTimeline([
      makeRow({ date: new Date('2024-06-10T12:00:00Z'), LATITUDE: null, LONGITUDE: null }),
    ]);
    expect(result.hasData).toBe(false);
  });

  it('includes non-geocoded requests in HUD counts but not on the map', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({ date: filed, SERVICEREQUESTID: '1' }),
      makeRow({
        date: filed,
        SERVICEREQUESTID: '2',
        LATITUDE: null,
        LONGITUDE: null,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    expect(result.timeline.displayPoints).toHaveLength(1);
    expect(openCountAtPlayhead(result.timeline, filed.getTime())).toBe(2);
    expect(result.timeline.filedRolling24[0]).toBe(2);
  });

  it('parses hydrate-style SERVICEDUEDATE strings for deadline coloring', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15 04:00:00 UTC',
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const point = result.timeline.displayPoints[0];
    expect(point.dueHourMs).not.toBeNull();
    expect(pastDeadlineAtPlayhead(point, point.dueHourMs!)).toBe(false);
    expect(pastDeadlineAtPlayhead(point, point.dueHourMs! + 1)).toBe(true);
  });

  it('uses size-only visibility without per-marker opacity', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const resolved = new Date('2024-06-11T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({ date: filed, RESOLUTIONDATE: toResolutionString(resolved) }),
    ]);
    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const playhead = playheadFromHourIndex(
      timeline,
      hourIndexAt(timeline, new Date('2024-06-11T11:00:00Z').setMinutes(0, 0, 0)),
    );
    const frame = buildRequestFlowFrame(timeline, playhead);
    const trace = frame.traces[MAIN_TRACE] as { marker?: { opacity?: number[]; size?: number[] } };

    expect(trace.marker?.opacity?.[0]).toBe(1);
    expect(trace.marker?.size?.[0]).toBeGreaterThan(0);
  });

  it('colors markers by deadline status at the playhead', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const resolvedLate = new Date('2024-06-13T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({ date: filed, SERVICEDUEDATE: '2024-06-20' }),
      makeRow({
        date: filed,
        SERVICEREQUESTID: '2',
        SERVICEDUEDATE: '2024-06-11',
        RESOLUTIONDATE: toResolutionString(resolvedLate),
        is_open: false,
        is_closed: true,
        resolution_days: 3,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const playhead = new Date('2024-06-12T12:00:00Z').getTime();
    const frame = buildRequestFlowFrame(result.timeline, playhead);
    const trace = frame.traces[MAIN_TRACE] as { marker?: { color?: string[]; size?: number[] } };
    const markerColors = trace.marker?.color ?? [];
    const markerSizes = trace.marker?.size ?? [];

    expect(pastDeadlineAtPlayhead(result.timeline.displayPoints[1], playhead)).toBe(true);
    expect(pastDeadlineAtPlayhead(result.timeline.displayPoints[0], playhead)).toBe(false);
    expect(markerColors[1]).toBe(colors.warning);
    expect(markerColors[0]).toBe('#2563EB');
    expect(markerSizes[0]).toBeGreaterThan(0);
    expect(markerSizes[1]).toBeGreaterThan(0);
  });

  it('does not wiggle outside the pre-deadline lead window', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({ date: filed, SERVICEDUEDATE: '2024-06-15' }),
      makeRow({
        date: filed,
        SERVICEREQUESTID: '2',
        SERVICEDUEDATE: '2024-06-20',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-18T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 8,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const dueHour = point.dueHourMs!;
    const beforeLead = dueHour - 5 * HOUR_MS;

    const buffers = markerBuffers(timeline.displayPoints.length);
    updateWithPulse(timeline, beforeLead, buffers, {
      phaseMs: 900,
      playing: true,
      previousPlayheadMs: beforeLead - HOUR_MS,
    });

    expect(pastDeadlineAtPlayhead(point, beforeLead)).toBe(false);
    expect(buffers.colors[0]).toBe('#2563EB');
    expect(buffers.sizes[0]).toBe(MARKER_SIZE);
    expect(buffers.opacities[0]).toBe(1);
    expect(collectRequestFlowWiggleDots(timeline, beforeLead, buffers.sizes, {
      phaseMs: 900,
      playing: true,
    })).toHaveLength(0);
  });

  it('wiggles during the pre-flip lead window', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-17T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 16,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const playhead = point.dueHourMs! - 2 * HOUR_MS;

    const frameA = markerBuffers(timeline.displayPoints.length);
    frameA.sizes[0] = MARKER_SIZE;
    const sessionsA = createRequestFlowOverlaySessions(timeline.displayPoints.length);
    advanceRequestFlowOverlaySessions(timeline, playhead, frameA.sizes, {
      phaseMs: 5050,
      playing: true,
      overlaySessions: sessionsA,
    });
    callUpdateMarkers(
      timeline,
      playhead,
      frameA,
      undefined,
      { phaseMs: 5050, playing: true, overlaySessions: sessionsA },
    );

    const frameB = markerBuffers(timeline.displayPoints.length);
    frameB.sizes[0] = MARKER_SIZE;
    const sessionsB = createRequestFlowOverlaySessions(timeline.displayPoints.length);
    advanceRequestFlowOverlaySessions(timeline, playhead, frameB.sizes, {
      phaseMs: 5125,
      playing: true,
      overlaySessions: sessionsB,
    });
    callUpdateMarkers(
      timeline,
      playhead,
      frameB,
      undefined,
      { phaseMs: 5125, playing: true, overlaySessions: sessionsB },
    );

    expect(pastDeadlineAtPlayhead(point, playhead)).toBe(false);
    expect(frameA.colors[0]).toBe('#2563EB');
    expect(frameA.opacities[0]).toBe(0);

    const clockA = { phaseMs: 5050, playing: true, overlaySessions: sessionsA };
    const clockB = { phaseMs: 5125, playing: true, overlaySessions: sessionsB };
    const dotsA = collectRequestFlowWiggleDots(timeline, playhead, frameA.sizes, clockA);
    const dotsB = collectRequestFlowWiggleDots(timeline, playhead, frameB.sizes, clockB);
    expect(dotsA).toHaveLength(1);
    expect(Math.abs(dotsA[0].offsetX)).toBeGreaterThan(0);
    expect(Math.abs(dotsB[0].offsetX - dotsA[0].offsetX)).toBeGreaterThan(0.2);
  });

  it('morphs past-due markers even when the pre-deadline approach window was skipped', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-17T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 16,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const justPastDue = point.dueHourMs! + HOUR_MS;
    const sizes = markerBuffers(timeline.displayPoints.length).sizes;
    sizes[0] = MARKER_SIZE;
    const phaseMs = 10_000 + DEADLINE_COCOON_MORPH_MS / 2;
    const sessions = seedOverlaySession(timeline, 0, {
      sessionStartMs: 9000,
      dueCrossedRealMs: 10_000,
      frozenPlayheadMs: justPastDue,
    });
    const clock = { phaseMs, playing: true, overlaySessions: sessions };

    const dots = collectRequestFlowWiggleDots(timeline, justPastDue, sizes, clock);

    expect(dots).toHaveLength(1);
    expect(dots[0].color).toContain('rgb(');
    expect(dots[0].color).not.toBe('#2563EB');
  });

  it('locks overlay diameter when buffer size changes during cocoon morph', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-17T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 16,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const justPastDue = point.dueHourMs! + HOUR_MS;
    const sizes = markerBuffers(timeline.displayPoints.length).sizes;
    sizes[0] = MARKER_SIZE;
    const sessions = seedOverlaySession(timeline, 0, {
      sessionStartMs: 9000,
      dueCrossedRealMs: 10_000,
      frozenPlayheadMs: justPastDue,
    });
    const clock = {
      phaseMs: 10_000 + DEADLINE_COCOON_MORPH_MS / 2,
      playing: true,
      overlaySessions: sessions,
    };

    const first = collectRequestFlowWiggleDots(timeline, justPastDue, sizes, clock);
    sizes[0] = MARKER_SIZE * 0.5;
    const second = collectRequestFlowWiggleDots(timeline, justPastDue, sizes, clock);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0].diameterPx).toBe(MARKER_SIZE * 2);
    expect(second[0].diameterPx).toBe(first[0].diameterPx);
  });

  it('wiggles blue then morphs into orange and settles', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-17T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 16,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const justPastDue = point.dueHourMs! + HOUR_MS;
    const sessions = seedOverlaySession(timeline, 0, {
      sessionStartMs: 9000,
      dueCrossedRealMs: 10_000,
      frozenPlayheadMs: justPastDue,
    });

    const wiggling = markerBuffers(timeline.displayPoints.length);
    wiggling.sizes[0] = MARKER_SIZE;
    callUpdateMarkers(
      timeline,
      justPastDue,
      wiggling,
      undefined,
      { phaseMs: 10_000 + 300, playing: true, overlaySessions: sessions },
    );

    const morphing = markerBuffers(timeline.displayPoints.length);
    morphing.sizes[0] = MARKER_SIZE;
    callUpdateMarkers(
      timeline,
      justPastDue,
      morphing,
      undefined,
      {
        phaseMs: 10_000 + DEADLINE_COCOON_MORPH_MS / 2,
        playing: true,
        overlaySessions: sessions,
      },
    );

    const settling = markerBuffers(timeline.displayPoints.length);
    settling.sizes[0] = MARKER_SIZE;
    callUpdateMarkers(
      timeline,
      justPastDue,
      settling,
      undefined,
      {
        phaseMs: 10_000 + DEADLINE_COCOON_MORPH_MS + DEADLINE_WIGGLE_SETTLE_MS / 2,
        playing: true,
        overlaySessions: sessions,
      },
    );

    const settled = markerBuffers(timeline.displayPoints.length);
    settled.sizes[0] = MARKER_SIZE;
    callUpdateMarkers(
      timeline,
      justPastDue,
      settled,
      undefined,
      {
        phaseMs: 10_000 + DEADLINE_POST_DUE_OVERLAY_MS + 20,
        playing: true,
        overlaySessions: sessions,
      },
    );

    expect(pastDeadlineAtPlayhead(point, justPastDue)).toBe(true);
    expect(wiggling.colors[0]).toBe('#2563EB');
    expect(wiggling.opacities[0]).toBe(0);
    const earlyDots = collectRequestFlowWiggleDots(
      timeline,
      justPastDue,
      wiggling.sizes,
      { phaseMs: 10_000 + 300, playing: true, overlaySessions: sessions },
    );
    expect(earlyDots).toHaveLength(1);
    expect(earlyDots[0].color.startsWith('rgb(')).toBe(true);
    expect(Math.abs(earlyDots[0].offsetX)).toBeGreaterThan(0);

    const morphDots = collectRequestFlowWiggleDots(
      timeline,
      justPastDue,
      morphing.sizes,
      {
        phaseMs: 10_000 + DEADLINE_COCOON_MORPH_MS / 2,
        playing: true,
        overlaySessions: sessions,
      },
    );
    expect(morphDots).toHaveLength(1);
    expect(morphDots[0].color.startsWith('rgb(')).toBe(true);
    expect(Math.abs(morphDots[0].offsetX)).toBeGreaterThan(0);

    const settleDots = collectRequestFlowWiggleDots(
      timeline,
      justPastDue,
      settling.sizes,
      {
        phaseMs: 10_000 + DEADLINE_COCOON_MORPH_MS + DEADLINE_WIGGLE_SETTLE_MS / 2,
        playing: true,
        overlaySessions: sessions,
      },
    );
    expect(settleDots).toHaveLength(1);
    expect(settleDots[0].color).toBe(colors.warning);
    expect(Math.abs(settleDots[0].offsetX)).toBeLessThan(Math.abs(morphDots[0].offsetX));

    expect(settled.colors[0]).toBe(colors.warning);
    expect(settled.opacities[0]).toBe(1);
    expect(collectRequestFlowWiggleDots(
      timeline,
      justPastDue,
      settled.sizes,
      {
        phaseMs: 10_000 + DEADLINE_POST_DUE_OVERLAY_MS + 20,
        playing: true,
        overlaySessions: sessions,
      },
    )).toHaveLength(0);
  });

  it('shows orange on canvas after overlay session clears', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-17T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 16,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const justPastDue = point.dueHourMs! + HOUR_MS;
    const sessions = createRequestFlowOverlaySessions(timeline.displayPoints.length);
    sessions.overlayCompleted[0] = 1;

    expect(markerColorAtPlayhead(
      point,
      justPastDue,
      { phaseMs: 20_000, playing: true, overlaySessions: sessions },
      0,
    )).toBe(colors.warning);
  });

  it('does not restart overlay after cocoon completes while still open past due', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-17T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 16,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const justPastDue = point.dueHourMs! + 12 * HOUR_MS;
    const sizes = markerBuffers(timeline.displayPoints.length).sizes;
    sizes[0] = MARKER_SIZE;
    const sessions = createRequestFlowOverlaySessions(timeline.displayPoints.length);
    sessions.overlayCompleted[0] = 1;

    advanceRequestFlowOverlaySessions(timeline, justPastDue, sizes, {
      phaseMs: 30_000,
      playing: true,
      overlaySessions: sessions,
    });

    expect(collectRequestFlowWiggleDots(
      timeline,
      justPastDue,
      sizes,
      { phaseMs: 30_000, playing: true, overlaySessions: sessions },
    )).toHaveLength(0);
    expect(sessions.sessionStartMs[0]).toBe(0);
  });

  it('keeps cocoon overlay when sim playhead jumps past the active hour bucket', () => {
    const filed = new Date('2024-06-01T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(new Date('2024-06-17T12:00:00Z')),
        is_open: false,
        is_closed: true,
        resolution_days: 16,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const farPastDue = point.dueHourMs! + 48 * HOUR_MS;
    const sessions = seedOverlaySession(timeline, 0, {
      sessionStartMs: 9000,
      dueCrossedRealMs: 10_000,
      frozenPlayheadMs: farPastDue,
    });

    const buffers = markerBuffers(timeline.displayPoints.length);
    buffers.sizes[0] = MARKER_SIZE;
    const dots = collectRequestFlowWiggleDots(
      timeline,
      farPastDue,
      buffers.sizes,
      {
        phaseMs: 10_000 + DEADLINE_COCOON_MORPH_MS / 2,
        playing: true,
        overlaySessions: sessions,
      },
    );

    expect(activeIndicesForPlayhead(timeline, farPastDue)).not.toContain(0);
    expect(dots).toHaveLength(1);
    expect(dots[0].color.startsWith('rgb(')).toBe(true);
  });

  it('does not wiggle resolved markers while they shrink out', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const resolvedLate = new Date('2024-06-17T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(resolvedLate),
        is_open: false,
        is_closed: true,
        resolution_days: 7,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const shrinking = point.fadeStartHour! + 2 * HOUR_MS;

    const buffers = markerBuffers(timeline.displayPoints.length);
    callUpdateMarkers(
      timeline,
      shrinking,
      buffers,
      undefined,
      { phaseMs: 600, playing: true },
    );

    expect(pastDeadlineAtPlayhead(point, shrinking)).toBe(true);
    expect(buffers.sizes[0]).toBeLessThan(MARKER_SIZE);
    expect(collectRequestFlowWiggleDots(timeline, shrinking, buffers.sizes, {
      phaseMs: 600,
      playing: true,
    })).toHaveLength(0);
  });

  it('does not wiggle past-deadline markers while paused', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const resolvedLate = new Date('2024-06-17T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        SERVICEDUEDATE: '2024-06-15',
        RESOLUTIONDATE: toResolutionString(resolvedLate),
        is_open: false,
        is_closed: true,
        resolution_days: 7,
      }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const pastDue = point.dueHourMs! + 12 * HOUR_MS;

    const buffers = markerBuffers(timeline.displayPoints.length);
    callUpdateMarkers(
      timeline,
      pastDue,
      buffers,
      undefined,
      { phaseMs: 900, playing: false },
    );

    expect(pastDeadlineAtPlayhead(point, pastDue)).toBe(true);
    expect(buffers.colors[0]).toBe(colors.warning);
    expect(buffers.sizes[0]).toBe(MARKER_SIZE);
    expect(buffers.opacities[0]).toBe(1);
    expect(collectRequestFlowWiggleDots(timeline, pastDue, buffers.sizes, {
      phaseMs: 900,
      playing: false,
    })).toHaveLength(0);
  });

  it('uses event lookup for unsampled open counts', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const resolved = new Date('2024-06-11T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({ date: filed, RESOLUTIONDATE: toResolutionString(resolved) }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const beforeFade = playheadFromHourIndex(
      timeline,
      hourIndexAt(timeline, new Date('2024-06-11T11:00:00Z').setMinutes(0, 0, 0)),
    );
    const fadeEnd = point.fadeStartHour! + FADE_OUT_HOURS * HOUR_MS;

    expect(openCountAtPlayhead(timeline, beforeFade)).toBe(1);
    expect(openCountAtPlayhead(timeline, fadeEnd + 1)).toBe(0);
  });

  it('shows every geocoded point on the map', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const rows = Array.from({ length: 6000 }, (_, index) => makeRow({
      date: filed,
      SERVICEREQUESTID: String(index + 1),
      LATITUDE: 38.9 + (index % 100) * 0.0001,
      LONGITUDE: -77.03 + (index % 100) * 0.0001,
    }));
    const result = prepareRequestFlowTimeline(rows);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    expect(timeline.displayPoints.length).toBe(6000);
    expect(timeline.filedRolling24[0]).toBe(6000);

    const frame = buildRequestFlowFrame(timeline, timeline.startMs);
    expect(frame.filedCount).toBe(6000);
    expect(frame.openCount).toBe(6000);
    const visibleCount = (frame.traces[MAIN_TRACE] as { marker?: { size?: number[] } }).marker?.size
      ?.filter((size) => size > 0).length;
    expect(visibleCount).toBe(6000);
  });

  it('reports 24-hour rolling filing and resolution totals', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({ date: filed }),
      makeRow({ date: new Date('2024-06-10T13:00:00Z'), SERVICEREQUESTID: '2' }),
    ]);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    expect(result.timeline.filedRolling24[1]).toBe(2);
    expect(result.timeline.filedRolling24[0]).toBe(1);
  });

  it('keeps a stable display set for smooth redraws', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const result = prepareRequestFlowTimeline([makeRow({ date: filed })]);
    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const first = buildRequestFlowFrame(result.timeline, result.timeline.startMs);
    const later = buildRequestFlowFrame(
      result.timeline,
      result.timeline.startMs + 6 * HOUR_MS,
    );
    const firstTrace = first.traces[0] as { lat?: number[] };
    const laterTrace = later.traces[0] as { lat?: number[] };
    expect(first.traces.length).toBe(later.traces.length);
    expect(first.traces.length).toBe(2);
    expect(firstTrace.lat?.length).toBe(laterTrace.lat?.length);
  });

  it('samples display points from daily active windows', () => {
    const rows = Array.from({ length: 2000 }, (_, index) => {
      const date = new Date('2024-01-01T12:00:00Z');
      date.setUTCDate(date.getUTCDate() + (index % 90));
      return makeRow({
        date,
        SERVICEREQUESTID: String(index + 1),
        LATITUDE: 38.9 + (index % 50) * 0.001,
        LONGITUDE: -77.03,
      });
    });
    const result = prepareRequestFlowTimeline(rows);

    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const midPlayhead = (timeline.startMs + timeline.endMs) / 2;
    const visible = visibleDisplayCountAt(timeline, midPlayhead);
    expect(visible).toBeGreaterThan(timeline.displayPoints.length * 0.15);
  });

  it('limits per-frame marker work to active indices after baseline paint', () => {
    const rows = Array.from({ length: 2000 }, (_, index) => {
      const date = new Date('2024-01-01T12:00:00Z');
      date.setUTCDate(date.getUTCDate() + (index % 90));
      return makeRow({
        date,
        SERVICEREQUESTID: String(index + 1),
        LATITUDE: 38.9 + (index % 50) * 0.001,
        LONGITUDE: -77.03,
      });
    });
    const result = prepareRequestFlowTimeline(rows);
    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const playheadMs = timeline.startMs + 48 * HOUR_MS;
    const nextPlayheadMs = playheadMs + HOUR_MS / 4;
    const baselineBuffers = markerBuffers(timeline.displayPoints.length);
    const activeBuffers = markerBuffers(timeline.displayPoints.length);
    const expectedBuffers = markerBuffers(timeline.displayPoints.length);

    updateRequestFlowMarkers(
      timeline,
      playheadMs,
      baselineBuffers.sizes,
      baselineBuffers.colors,
      baselineBuffers.opacities,
      baselineBuffers.customdata,
      undefined,
      { phaseMs: 0, playing: false },
      'all',
    );

    for (let index = 0; index < timeline.displayPoints.length; index += 1) {
      activeBuffers.sizes[index] = baselineBuffers.sizes[index];
      activeBuffers.colors[index] = baselineBuffers.colors[index];
      activeBuffers.opacities[index] = baselineBuffers.opacities[index];
    }
    activeBuffers.customdata = baselineBuffers.customdata.map((entry) => [...entry] as [string, string, string, string]);

    updateRequestFlowMarkers(
      timeline,
      nextPlayheadMs,
      expectedBuffers.sizes,
      expectedBuffers.colors,
      expectedBuffers.opacities,
      expectedBuffers.customdata,
      undefined,
      { phaseMs: 0, playing: false },
      'all',
    );

    updateRequestFlowMarkers(
      timeline,
      nextPlayheadMs,
      activeBuffers.sizes,
      activeBuffers.colors,
      activeBuffers.opacities,
      activeBuffers.customdata,
      undefined,
      { phaseMs: 0, playing: false },
      'active',
      playheadMs,
    );

    const activeIndices = activeIndicesForPlayheadStep(timeline, playheadMs, nextPlayheadMs);
    expect(activeIndices.length).toBeLessThan(timeline.displayPoints.length);

    for (let index = 0; index < timeline.displayPoints.length; index += 1) {
      expect(activeBuffers.sizes[index]).toBe(expectedBuffers.sizes[index]);
      expect(activeBuffers.colors[index]).toBe(expectedBuffers.colors[index]);
      expect(activeBuffers.opacities[index]).toBe(expectedBuffers.opacities[index]);
    }
  });

  it('reconciles markers left small when playhead jumps past fade-in', () => {
    const filed = new Date('2024-06-10T12:00:00Z');
    const resolved = new Date('2024-07-10T12:00:00Z');
    const result = prepareRequestFlowTimeline([
      makeRow({
        date: filed,
        RESOLUTIONDATE: toResolutionString(resolved),
        is_open: false,
        is_closed: true,
      }),
    ]);
    expect(result.hasData).toBe(true);
    if (!result.hasData) return;

    const { timeline } = result;
    const point = timeline.displayPoints[0];
    const afterFadePlayhead = point.filedHour + 1.35 * HOUR_MS + 2 * HOUR_MS;
    const buffers = markerBuffers(timeline.displayPoints.length);

    updateRequestFlowMarkers(
      timeline,
      afterFadePlayhead,
      buffers.sizes,
      buffers.colors,
      buffers.opacities,
      buffers.customdata,
      undefined,
      { phaseMs: 0, playing: false },
      'all',
    );
    expect(buffers.sizes[0]).toBe(MARKER_SIZE);

    buffers.sizes[0] = 3.5;

    updateRequestFlowMarkers(
      timeline,
      afterFadePlayhead,
      buffers.sizes,
      buffers.colors,
      buffers.opacities,
      buffers.customdata,
      undefined,
      { phaseMs: 0, playing: false },
      'active',
      point.filedHour + 0.25 * 1.35 * HOUR_MS,
    );

    expect(buffers.sizes[0]).toBe(MARKER_SIZE);
  });

  it('advances simulated time proportional to real playback speed', () => {
    expect(SIM_MS_PER_REAL_MS).toBe(3_600_000 / REQUEST_FLOW_HOUR_MS);
  });
});
