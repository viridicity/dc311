import { ProcessedRequest } from './dataProcessing';
import {
  categoryShapeIcon,
  REQUEST_FLOW_MARKER_RADIUS_PX,
  REQUEST_FLOW_SHAPE_ICON_INDEX,
  requestFlowSpriteIndex,
} from './requestFlowCategoryShapes';
import {
  buildRequestFlowGeometry,
  buildRequestFlowSpatialIndex,
  type RequestFlowGeometry,
  type RequestFlowSpatialIndex,
} from './requestFlowGeometry';
import type { RequestFlowMarkerBuffers } from './requestFlowMapLayers';
import type { RequestFlowWiggleDot } from './requestFlowWiggleOverlay';
import { colors } from './theme';

export type { RequestFlowWiggleDot };

const WITHIN_DEADLINE_COLOR = '#2563EB';
const PAST_DEADLINE_COLOR = colors.warning;

const HOUR_MS = 3_600_000;
const MIN_VISIBLE_MS = 24 * HOUR_MS;
/** Simulated hours to dissolve a resolved dot. */
export const FADE_OUT_HOURS = 24;
/** Quick fade-in window in simulated hours. */
const FADE_IN_HOURS = 1.35;
const FADE_IN_MS = FADE_IN_HOURS * HOUR_MS;
/** Simulated lead before due when the pre-flip wiggle begins. */
const DEADLINE_WIGGLE_SIM_MS = 4 * HOUR_MS;
/** Real-time cocoon morph: blue wiggle becomes orange while still wiggling. */
export const DEADLINE_COCOON_MORPH_MS = 520;
/** Real-time orange wiggle damps to still before map handoff. */
export const DEADLINE_WIGGLE_SETTLE_MS = 400;
export const DEADLINE_POST_DUE_OVERLAY_MS = DEADLINE_COCOON_MORPH_MS + DEADLINE_WIGGLE_SETTLE_MS;
const WIGGLE_MAX_PX = 2.5;
/** Horizontal oscillations per second during the pre-deadline wiggle. */
const WIGGLE_FREQ_HZ = 7;
const WIGGLE_OMEGA = (2 * Math.PI * WIGGLE_FREQ_HZ) / 1000;
const FADE_OUT_MS = FADE_OUT_HOURS * HOUR_MS;
const INV_FADE_IN_MS = 1 / FADE_IN_MS;
const INV_FADE_OUT_MS = 1 / FADE_OUT_MS;
const MARKER_SIZE = REQUEST_FLOW_MARKER_RADIUS_PX;
/** One simulated day (~24 hours) plays in one second. */
export const REQUEST_FLOW_HOUR_MS = Math.round(1000 / 24);
/** Simulated milliseconds advanced per real millisecond during playback. */
export const SIM_MS_PER_REAL_MS = HOUR_MS / REQUEST_FLOW_HOUR_MS;

/** Flat display record — no indirection through displayIndices during playback. */
export interface FlowDisplayPoint {
  lat: number;
  lon: number;
  customdata: [string, string, string, string];
  shapeIcon: string;
  shapeIndex: number;
  filedHour: number;
  resolvedHour: number | null;
  dueHourMs: number | null;
  fadeStartHour: number | null;
  fadeEndHour: number | null;
}

/** Minimal fields for HUD visibility counts across every indexed request. */
interface FlowStat {
  filedHour: number;
  fadeStartHour: number | null;
}

export interface RequestFlowTimeline {
  displayPoints: FlowDisplayPoint[];
  geometry: RequestFlowGeometry;
  spatialIndex: RequestFlowSpatialIndex;
  /** Per-hour display indices that need per-frame marker updates. */
  activeHourIndices: number[][];
  /** Per-hour indices that may need cleanup when active buckets skip them. */
  reconcileHourIndices: number[][];
  startMs: number;
  endMs: number;
  hourCount: number;
  dayLabelByHourIndex: string[];
  scrubStartLabel: string;
  scrubEndLabel: string;
  openCountTimes: number[];
  openCountTotals: number[];
  filedRolling24: number[];
  resolvedRolling24: number[];
}

export type RequestFlowTimelineResult =
  | { hasData: false }
  | { hasData: true; timeline: RequestFlowTimeline };

function parseResolutionDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value.replace(' ', 'T').replace(' UTC', 'Z'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseServiceDueDate(value: string | null): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value.replace(' ', 'T').replace(' UTC', 'Z'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dueHourFromRow(row: ProcessedRequest): number | null {
  const dueDate = parseServiceDueDate(row.SERVICEDUEDATE);
  return dueDate ? hourKey(dueDate) : null;
}

function startOfHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function hourKey(date: Date): number {
  return startOfHour(date).getTime();
}

function formatHourLabel(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
  });
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildDayLabelByHourIndex(startMs: number, hourCount: number): string[] {
  const labels = new Array<string>(hourCount);
  for (let index = 0; index < hourCount; index += 1) {
    labels[index] = formatDayLabel(new Date(startMs + index * HOUR_MS));
  }
  return labels;
}

function buildRolling24Counts(
  hourCount: number,
  startMs: number,
  byHour: Map<number, number>,
): number[] {
  const rolling = new Array<number>(hourCount);
  let sum = 0;
  for (let index = 0; index < hourCount; index += 1) {
    sum += byHour.get(startMs + index * HOUR_MS) ?? 0;
    if (index >= 24) {
      sum -= byHour.get(startMs + (index - 24) * HOUR_MS) ?? 0;
    }
    rolling[index] = sum;
  }
  return rolling;
}

function buildOpenCountLookup(stats: FlowStat[]): { times: number[]; totals: number[] } {
  const deltaByHour = new Map<number, number>();
  for (const stat of stats) {
    deltaByHour.set(stat.filedHour, (deltaByHour.get(stat.filedHour) ?? 0) + 1);
    if (stat.fadeStartHour !== null) {
      const fadeEnd = stat.fadeStartHour + FADE_OUT_MS;
      deltaByHour.set(fadeEnd, (deltaByHour.get(fadeEnd) ?? 0) - 1);
    }
  }

  const times = [...deltaByHour.keys()].sort((left, right) => left - right);
  const totals = new Array<number>(times.length);
  let open = 0;
  for (let index = 0; index < times.length; index += 1) {
    open += deltaByHour.get(times[index]) ?? 0;
    totals[index] = open;
  }

  return { times, totals };
}

/** Returns unsampled open count at a playhead via binary search on prep events. */
export function openCountAtPlayhead(timeline: RequestFlowTimeline, playheadMs: number): number {
  const { openCountTimes: times, openCountTotals: totals } = timeline;
  if (times.length === 0 || playheadMs < times[0]) {
    return 0;
  }

  let lo = 0;
  let hi = times.length - 1;
  let match = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= playheadMs) {
      match = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return match >= 0 ? totals[match] : 0;
}

function flowTimingFromRow(row: ProcessedRequest): {
  filedHour: number;
  resolvedHour: number | null;
  fadeStartHour: number | null;
  maxHourKey: number;
} {
  const resolvedAt = parseResolutionDate(row.RESOLUTIONDATE);
  const filedHour = hourKey(row.date);
  const resolvedHour = resolvedAt ? hourKey(resolvedAt) : null;
  const fadeStart = fadeStartHour(filedHour, resolvedHour);
  let maxHourKey = filedHour;
  if (resolvedHour !== null && resolvedHour > maxHourKey) {
    maxHourKey = resolvedHour;
  }
  if (fadeStart !== null) {
    maxHourKey = Math.max(maxHourKey, fadeStart + FADE_OUT_MS);
  }
  return { filedHour, resolvedHour, fadeStartHour: fadeStart, maxHourKey };
}

function incrementHourCount(map: Map<number, number>, hourKeyMs: number): void {
  map.set(hourKeyMs, (map.get(hourKeyMs) ?? 0) + 1);
}

/** Whether a request is past its promised deadline at the simulated playhead. */
export function pastDeadlineAtPlayhead(
  point: Pick<FlowDisplayPoint, 'dueHourMs' | 'resolvedHour' | 'filedHour'>,
  playheadMs: number,
): boolean {
  if (point.dueHourMs === null || playheadMs < point.filedHour) {
    return false;
  }

  const resolvedHour = point.resolvedHour;
  if (resolvedHour !== null && playheadMs >= resolvedHour) {
    return resolvedHour > point.dueHourMs;
  }

  return playheadMs > point.dueHourMs;
}

export interface RequestFlowOverlaySessions {
  /** Real time when the overlay sequence started; 0 = inactive. */
  sessionStartMs: Float64Array;
  /** Real time when sim playhead crossed the due date; 0 = still in approach. */
  dueCrossedRealMs: Float64Array;
  /** Sim playhead captured when the session started — used for canvas handoff size. */
  frozenPlayheadMs: Float64Array;
  /** Normalized marker radius locked for the full overlay sequence. */
  lockedRadius: Float64Array;
  /** Set when wiggle/cocoon finishes — prevents restarting while still open past due. */
  overlayCompleted: Uint8Array;
}

export interface RequestFlowPulseClock {
  /** performance.now() while the map is playing. */
  phaseMs: number;
  playing: boolean;
  /** Prior simulated playhead — used when scrubbing backward. */
  previousPlayheadMs?: number;
  overlaySessions?: RequestFlowOverlaySessions;
}

/** Allocates per-marker overlay session buffers. */
export function createRequestFlowOverlaySessions(pointCount: number): RequestFlowOverlaySessions {
  return {
    sessionStartMs: new Float64Array(pointCount),
    dueCrossedRealMs: new Float64Array(pointCount),
    frozenPlayheadMs: new Float64Array(pointCount),
    lockedRadius: new Float64Array(pointCount),
    overlayCompleted: new Uint8Array(pointCount),
  };
}

/** Clears every in-flight overlay session. */
export function resetRequestFlowOverlaySessions(sessions: RequestFlowOverlaySessions): void {
  sessions.sessionStartMs.fill(0);
  sessions.dueCrossedRealMs.fill(0);
  sessions.frozenPlayheadMs.fill(0);
  sessions.lockedRadius.fill(0);
  sessions.overlayCompleted.fill(0);
}

function clearOverlaySession(sessions: RequestFlowOverlaySessions, index: number): void {
  sessions.sessionStartMs[index] = 0;
  sessions.dueCrossedRealMs[index] = 0;
  sessions.frozenPlayheadMs[index] = 0;
  sessions.lockedRadius[index] = 0;
}

function canStartOverlaySession(
  point: Pick<FlowDisplayPoint, 'dueHourMs' | 'resolvedHour' | 'filedHour' | 'fadeStartHour'>,
  playheadMs: number,
  sessions: RequestFlowOverlaySessions,
  index: number,
): boolean {
  if (point.dueHourMs === null || !isOpenAtPlayhead(point, playheadMs)) {
    return false;
  }
  if (sessions.overlayCompleted[index]) {
    return false;
  }
  return playheadMs >= point.dueHourMs - DEADLINE_WIGGLE_SIM_MS;
}

function overlaySessionPostDueMs(
  sessions: RequestFlowOverlaySessions,
  index: number,
  phaseMs: number,
): number {
  const dueCrossed = sessions.dueCrossedRealMs[index];
  if (dueCrossed <= 0) return -1;
  return phaseMs - dueCrossed;
}

function isOverlaySessionActive(
  sessions: RequestFlowOverlaySessions,
  index: number,
  phaseMs: number,
): boolean {
  if (sessions.sessionStartMs[index] <= 0) return false;
  const postDue = overlaySessionPostDueMs(sessions, index, phaseMs);
  return postDue < DEADLINE_POST_DUE_OVERLAY_MS;
}

/** Real-time ms for the wiggle lead at playback speed. */
export function deadlineWiggleLeadRealMs(): number {
  return DEADLINE_WIGGLE_SIM_MS / SIM_MS_PER_REAL_MS;
}

/** Smooth horizontal sine wiggle; phase varies per dot so they don't move in lockstep. */
function deadlineWiggleOffset(phaseMs: number, pointIndex: number): { x: number; y: number } {
  const phaseOffset = pointIndex * 0.35;
  return {
    x: WIGGLE_MAX_PX * Math.sin(phaseMs * WIGGLE_OMEGA + phaseOffset),
    y: 0,
  };
}

function easeInCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x ** 3;
}

function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

function lerpHexColor(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const normalized = hex.replace('#', '');
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  };
  const [r0, g0, b0] = parse(from);
  const [r1, g1, b1] = parse(to);
  const u = Math.max(0, Math.min(1, t));
  const r = Math.round(r0 + (r1 - r0) * u);
  const g = Math.round(g0 + (g1 - g0) * u);
  const b = Math.round(b0 + (b1 - b0) * u);
  return `rgb(${r}, ${g}, ${b})`;
}

function overlayVisualFromSession(
  sessions: RequestFlowOverlaySessions,
  index: number,
  phaseMs: number,
): { offsetX: number; color: string } {
  const offset = deadlineWiggleOffset(phaseMs, index);
  const postDue = overlaySessionPostDueMs(sessions, index, phaseMs);
  if (postDue < 0) {
    return { offsetX: offset.x, color: WITHIN_DEADLINE_COLOR };
  }
  if (postDue < DEADLINE_COCOON_MORPH_MS) {
    const morphT = easeInOutCubic(postDue / DEADLINE_COCOON_MORPH_MS);
    return {
      offsetX: offset.x,
      color: lerpHexColor(WITHIN_DEADLINE_COLOR, PAST_DEADLINE_COLOR, morphT),
    };
  }

  const settleT = (postDue - DEADLINE_COCOON_MORPH_MS) / DEADLINE_WIGGLE_SETTLE_MS;
  const damp = 1 - easeOutCubic(settleT);
  return {
    offsetX: offset.x * damp,
    color: PAST_DEADLINE_COLOR,
  };
}

/** Advances overlay sessions; returns indices whose overlay sequence just finished. */
export function advanceRequestFlowOverlaySessions(
  timeline: RequestFlowTimeline,
  playheadMs: number,
  sizes: number[],
  clock: RequestFlowPulseClock,
): number[] {
  const endedIndices: number[] = [];
  if (!clock.playing || !clock.overlaySessions) return endedIndices;

  const sessions = clock.overlaySessions;
  const clampedPlayhead = Math.max(timeline.startMs, Math.min(playheadMs, timeline.endMs));
  const candidates = new Set<number>();

  const active = activeIndicesForPlayhead(timeline, clampedPlayhead);
  for (let i = 0; i < active.length; i += 1) {
    candidates.add(active[i]);
  }
  for (let index = 0; index < timeline.displayPoints.length; index += 1) {
    if (sessions.sessionStartMs[index] > 0) candidates.add(index);
  }

  for (const index of candidates) {
    const point = timeline.displayPoints[index];

    if (sessions.sessionStartMs[index] <= 0) {
      if (!canStartOverlaySession(point, clampedPlayhead, sessions, index)) continue;
      const radius = sizes[index] > 0 ? sizes[index] : markerSizeAt(point, clampedPlayhead);
      if (radius <= 0) continue;
      sessions.sessionStartMs[index] = clock.phaseMs;
      sessions.frozenPlayheadMs[index] = clampedPlayhead;
      sessions.lockedRadius[index] = radius;
    }

    if (!isOpenAtPlayhead(point, clampedPlayhead)) {
      sessions.overlayCompleted[index] = 1;
      clearOverlaySession(sessions, index);
      endedIndices.push(index);
      continue;
    }

    if (
      pastDeadlineAtPlayhead(point, clampedPlayhead)
      && sessions.dueCrossedRealMs[index] <= 0
    ) {
      sessions.dueCrossedRealMs[index] = clock.phaseMs;
    }

    const postDue = overlaySessionPostDueMs(sessions, index, clock.phaseMs);
    if (postDue >= DEADLINE_POST_DUE_OVERLAY_MS) {
      sessions.overlayCompleted[index] = 1;
      clearOverlaySession(sessions, index);
      endedIndices.push(index);
    }
  }

  return endedIndices;
}

function isOnWiggleOverlay(
  point: Pick<FlowDisplayPoint, 'dueHourMs' | 'resolvedHour' | 'filedHour' | 'fadeStartHour'>,
  playheadMs: number,
  clock: RequestFlowPulseClock,
  index: number,
  baseSize: number,
): boolean {
  if (!clock.playing || baseSize <= 0 || !clock.overlaySessions) {
    return false;
  }

  const sessions = clock.overlaySessions;
  if (isOverlaySessionActive(sessions, index, clock.phaseMs)) {
    return true;
  }

  return sessions.sessionStartMs[index] <= 0
    && canStartOverlaySession(point, playheadMs, sessions, index);
}

/** Playback-only color: map stays blue until the overlay cocoon finishes. */
function visualPastDeadlineAtPlayhead(
  point: Pick<FlowDisplayPoint, 'dueHourMs' | 'resolvedHour' | 'filedHour' | 'fadeStartHour'>,
  playheadMs: number,
  clock: RequestFlowPulseClock,
  index: number,
): boolean {
  if (!pastDeadlineAtPlayhead(point, playheadMs)) {
    return false;
  }

  if (!clock.playing || !clock.overlaySessions) {
    return true;
  }

  const sessions = clock.overlaySessions;
  if (!isOverlaySessionActive(sessions, index, clock.phaseMs)) {
    return true;
  }

  const postDue = overlaySessionPostDueMs(sessions, index, clock.phaseMs);
  if (postDue < 0) {
    return false;
  }

  return postDue >= DEADLINE_POST_DUE_OVERLAY_MS;
}

export function markerColorAtPlayhead(
  point: Pick<FlowDisplayPoint, 'dueHourMs' | 'resolvedHour' | 'filedHour' | 'fadeStartHour'>,
  playheadMs: number,
  clock?: RequestFlowPulseClock,
  index?: number,
): string {
  const pastDue = clock?.playing && clock.overlaySessions && index !== undefined
    ? visualPastDeadlineAtPlayhead(point, playheadMs, clock, index)
    : pastDeadlineAtPlayhead(point, playheadMs);
  return pastDue ? PAST_DEADLINE_COLOR : WITHIN_DEADLINE_COLOR;
}

function deadlineLabelAtPlayhead(
  point: Pick<FlowDisplayPoint, 'dueHourMs' | 'resolvedHour' | 'filedHour' | 'fadeStartHour'>,
  playheadMs: number,
  clock?: RequestFlowPulseClock,
  index?: number,
): string {
  if (point.dueHourMs === null) return 'No deadline set';
  const pastDue = clock?.playing && clock.overlaySessions && index !== undefined
    ? visualPastDeadlineAtPlayhead(point, playheadMs, clock, index)
    : pastDeadlineAtPlayhead(point, playheadMs);
  return pastDue ? 'Past deadline' : 'Within deadline';
}

function isOpenAtPlayhead(
  point: Pick<FlowDisplayPoint, 'resolvedHour' | 'filedHour' | 'fadeStartHour'>,
  playheadMs: number,
): boolean {
  if (playheadMs < point.filedHour) {
    return false;
  }
  if (point.fadeStartHour !== null && playheadMs >= point.fadeStartHour) {
    return false;
  }
  return point.resolvedHour === null || playheadMs < point.resolvedHour;
}

function deadlineMarkerVisual(
  point: Pick<FlowDisplayPoint, 'dueHourMs' | 'resolvedHour' | 'filedHour' | 'fadeStartHour'>,
  playheadMs: number,
  clock: RequestFlowPulseClock,
  baseSize: number,
  pointIndex: number,
): { size: number; opacity: number } {
  const idle = {
    size: baseSize,
    opacity: baseSize > 0 ? 1 : 0,
  };

  if (baseSize <= 0) {
    return idle;
  }

  const sessions = clock.overlaySessions;
  if (sessions && isOverlaySessionActive(sessions, pointIndex, clock.phaseMs)) {
    const locked = sessions.lockedRadius[pointIndex];
    return { size: locked > 0 ? locked : baseSize, opacity: 0 };
  }

  if (!isOnWiggleOverlay(point, playheadMs, clock, pointIndex, baseSize)) {
    return idle;
  }

  return { ...idle, opacity: 0 };
}

function markerPopScale(sincePopMs: number): number {
  if (sincePopMs < 0 || sincePopMs >= FADE_IN_MS) {
    return 1;
  }
  return 0.45 + 0.72 * easeOutBack(sincePopMs * INV_FADE_IN_MS, 1.9);
}

function fadeStartHour(filedHour: number, resolvedHour: number | null): number | null {
  if (resolvedHour === null) return null;
  return Math.max(resolvedHour, filedHour + MIN_VISIBLE_MS);
}

function easeOutBack(t: number, overshoot = 1.65): number {
  const x = Math.max(0, Math.min(1, t));
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

export function markerSizeAt(
  point: FlowDisplayPoint,
  playheadMs: number,
): number {
  if (playheadMs < point.filedHour) {
    return 0;
  }
  if (point.fadeEndHour !== null && playheadMs >= point.fadeEndHour) {
    return 0;
  }

  const sinceFiled = playheadMs - point.filedHour;
  let size = MARKER_SIZE;

  if (sinceFiled < FADE_IN_MS) {
    size = MARKER_SIZE * markerPopScale(sinceFiled);
  }

  if (point.fadeStartHour !== null && playheadMs >= point.fadeStartHour) {
    const shrinkT = easeInCubic((playheadMs - point.fadeStartHour) * INV_FADE_OUT_MS);
    const shrinkScale = 1 - shrinkT;
    size = sinceFiled >= FADE_IN_MS ? MARKER_SIZE * shrinkScale : size * shrinkScale;
  }

  return size < 0.4 ? 0 : size;
}

export interface RequestFlowMarkerUpdate {
  customdataChanged: boolean;
  visualsChanged: boolean;
  changedIndices: number[];
}

export type RequestFlowMarkerUpdateScope = 'all' | 'active';

/** Full pass after scrub, rewind, or first paint; active-only during forward playback. */
export function resolveMarkerUpdateScope(
  previousPlayheadMs: number,
  playheadMs: number,
  forceFull = false,
): RequestFlowMarkerUpdateScope {
  if (forceFull || playheadMs < previousPlayheadMs) {
    return 'all';
  }
  return 'active';
}

function pushHourIndex(
  buckets: (number[] | undefined)[],
  hour: number,
  index: number,
): void {
  if (hour < 0 || hour >= buckets.length) return;
  const bucket = buckets[hour];
  if (bucket) {
    bucket.push(index);
  } else {
    buckets[hour] = [index];
  }
}

function addActiveRangeToHourBuckets(
  buckets: (number[] | undefined)[],
  startMs: number,
  hourCount: number,
  index: number,
  rangeStartMs: number,
  rangeEndMs: number,
): void {
  if (rangeEndMs <= rangeStartMs) return;

  let startHour = Math.floor((rangeStartMs - startMs) / HOUR_MS);
  let endHour = Math.floor((rangeEndMs - startMs) / HOUR_MS);
  startHour = Math.max(0, startHour);
  endHour = Math.min(hourCount - 1, endHour);
  for (let hour = startHour; hour <= endHour; hour += 1) {
    pushHourIndex(buckets, hour, index);
  }
}

function finalizeHourBuckets(buckets: (number[] | undefined)[]): number[][] {
  const finalized = new Array<number[]>(buckets.length);
  for (let hour = 0; hour < buckets.length; hour += 1) {
    finalized[hour] = buckets[hour] ?? [];
  }
  return finalized;
}

function visibleEndMsForActiveRange(point: FlowDisplayPoint, timelineEndMs: number): number {
  if (point.fadeEndHour !== null) return point.fadeEndHour;
  return timelineEndMs;
}

/** Buckets fade, fade-out, and deadline pulse windows by hour for partial redraws. */
function buildActiveHourIndices(
  displayPoints: FlowDisplayPoint[],
  startMs: number,
  endMs: number,
  hourCount: number,
): number[][] {
  const buckets: (number[] | undefined)[] = new Array(hourCount);

  for (let index = 0; index < displayPoints.length; index += 1) {
    const point = displayPoints[index];
    const visibleEnd = visibleEndMsForActiveRange(point, endMs);

    addActiveRangeToHourBuckets(
      buckets,
      startMs,
      hourCount,
      index,
      point.filedHour,
      Math.min(point.filedHour + FADE_IN_MS + HOUR_MS, visibleEnd),
    );

    if (point.fadeStartHour !== null && point.fadeEndHour !== null) {
      addActiveRangeToHourBuckets(
        buckets,
        startMs,
        hourCount,
        index,
        point.fadeStartHour,
        point.fadeEndHour,
      );
    }

    if (point.dueHourMs !== null) {
      const wiggleStart = point.dueHourMs - DEADLINE_WIGGLE_SIM_MS;
      if (wiggleStart < visibleEnd) {
        const wiggleEnd = Math.min(point.dueHourMs + HOUR_MS, visibleEnd);
        addActiveRangeToHourBuckets(buckets, startMs, hourCount, index, wiggleStart, wiggleEnd);
      }
    }
  }

  return finalizeHourBuckets(buckets);
}

/** Small per-hour lists for lifecycle cleanup without scanning every display slot. */
function buildReconcileHourIndices(
  displayPoints: FlowDisplayPoint[],
  startMs: number,
  hourCount: number,
): number[][] {
  const buckets: (number[] | undefined)[] = new Array(hourCount);

  for (let index = 0; index < displayPoints.length; index += 1) {
    const point = displayPoints[index];
    const filedHour = Math.floor((point.filedHour - startMs) / HOUR_MS);
    pushHourIndex(buckets, filedHour, index);
    pushHourIndex(buckets, filedHour - 1, index);

    if (point.fadeStartHour !== null) {
      pushHourIndex(
        buckets,
        Math.floor((point.fadeStartHour - startMs) / HOUR_MS),
        index,
      );
    }

    if (point.fadeEndHour !== null) {
      const fadeEndHour = Math.floor((point.fadeEndHour - startMs) / HOUR_MS);
      pushHourIndex(buckets, fadeEndHour, index);
      pushHourIndex(buckets, fadeEndHour + 1, index);
    }
  }

  return finalizeHourBuckets(buckets);
}

/** Active display indices for the playhead hour — fade, pulse, and transition dots. */
export function activeIndicesForPlayhead(
  timeline: RequestFlowTimeline,
  playheadMs: number,
): readonly number[] {
  const hourIndex = hourIndexAt(timeline, playheadMs);
  return timeline.activeHourIndices[hourIndex] ?? [];
}

/** Unions active buckets across a forward playhead step so skipped hours still update. */
export function activeIndicesForPlayheadStep(
  timeline: RequestFlowTimeline,
  previousPlayheadMs: number,
  playheadMs: number,
): number[] {
  const endHour = hourIndexAt(timeline, playheadMs);
  if (playheadMs <= previousPlayheadMs) {
    return timeline.activeHourIndices[endHour] ?? [];
  }

  const startHour = hourIndexAt(timeline, previousPlayheadMs);
  if (startHour === endHour) {
    return timeline.activeHourIndices[endHour] ?? [];
  }

  const indices = new Set<number>();
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const bucket = timeline.activeHourIndices[hour];
    if (!bucket) continue;
    for (let index = 0; index < bucket.length; index += 1) {
      indices.add(bucket[index]);
    }
  }
  return [...indices];
}

/** Lifecycle boundary indices that may need cleanup during active-only playback. */
export function reconcileIndicesForPlayheadStep(
  timeline: RequestFlowTimeline,
  previousPlayheadMs: number,
  playheadMs: number,
): readonly number[] {
  const endHour = hourIndexAt(timeline, playheadMs);
  if (playheadMs <= previousPlayheadMs) {
    return timeline.reconcileHourIndices[endHour] ?? [];
  }

  const startHour = hourIndexAt(timeline, previousPlayheadMs);
  if (startHour === endHour) {
    return timeline.reconcileHourIndices[endHour] ?? [];
  }

  const indices = new Set<number>();
  for (let hour = startHour; hour <= endHour; hour += 1) {
    const bucket = timeline.reconcileHourIndices[hour];
    if (!bucket) continue;
    for (let index = 0; index < bucket.length; index += 1) {
      indices.add(bucket[index]);
    }
  }
  return [...indices];
}

/** Cheap guard against stale buffers when active-only updates skip lifecycle boundaries. */
function markerNeedsReconcile(
  timeline: RequestFlowTimeline,
  index: number,
  playheadMs: number,
  sizes: number[],
  colors: string[],
  opacities: number[],
  culled: Uint8Array | undefined,
  pulseClock: RequestFlowPulseClock,
): boolean {
  if (culled?.[index]) {
    return sizes[index] !== 0 || colors[index] !== WITHIN_DEADLINE_COLOR;
  }

  const point = timeline.displayPoints[index];
  if (point.fadeEndHour !== null && playheadMs >= point.fadeEndHour) {
    return sizes[index] !== 0;
  }

  const expectedSize = markerSizeAt(point, playheadMs);
  if (Math.abs(sizes[index] - expectedSize) > 0.35) {
    return true;
  }

  if (expectedSize <= 0) {
    return sizes[index] > 0;
  }

  const expectedColor = markerColorAtPlayhead(point, playheadMs, pulseClock, index);
  if (colors[index] !== expectedColor) {
    return true;
  }

  const crossedAt = pulseClock.overlaySessions?.dueCrossedRealMs[index] ?? 0;
  if (crossedAt > 0 && pulseClock.overlaySessions) {
    const postDue = pulseClock.phaseMs - crossedAt;
    if (postDue >= 0 && postDue < DEADLINE_POST_DUE_OVERLAY_MS) {
      return opacities[index] !== 0;
    }
  }

  const visual = deadlineMarkerVisual(point, playheadMs, pulseClock, expectedSize, index);
  return opacities[index] !== visual.opacity;
}

interface VisibleRenderTracking {
  visibleIndices: number[];
  visibleIndexSlots: Int32Array;
  screenValid?: Uint8Array;
}

/** Keeps a dense list of drawable marker indices for canvas rendering. */
export function syncRequestFlowVisibleIndex(
  tracking: VisibleRenderTracking & { sizes: number[]; opacities: number[] },
  index: number,
): void {
  syncVisibleRenderIndex(index, tracking.sizes[index], tracking.opacities[index], tracking);
}

function syncVisibleRenderIndex(
  index: number,
  size: number,
  opacity: number,
  tracking: VisibleRenderTracking | undefined,
): void {
  if (!tracking) return;

  const visible = size > 0 && opacity > 0;
  const slot = tracking.visibleIndexSlots[index];
  if (visible) {
    if (slot >= 0) return;
    tracking.visibleIndexSlots[index] = tracking.visibleIndices.length;
    tracking.visibleIndices.push(index);
    if (tracking.screenValid) tracking.screenValid[index] = 0;
    return;
  }

  if (slot < 0) return;
  const lastIndex = tracking.visibleIndices[tracking.visibleIndices.length - 1];
  tracking.visibleIndices[slot] = lastIndex;
  tracking.visibleIndexSlots[lastIndex] = slot;
  tracking.visibleIndices.pop();
  tracking.visibleIndexSlots[index] = -1;
  if (tracking.screenValid) tracking.screenValid[lastIndex] = 0;
}

function applyMarkerUpdateAtIndex(
  timeline: RequestFlowTimeline,
  index: number,
  clampedPlayhead: number,
  sizes: number[],
  colors: string[],
  opacities: number[],
  customdata: [string, string, string, string][],
  culled: Uint8Array | undefined,
  pulseClock: RequestFlowPulseClock,
  visibleTracking?: VisibleRenderTracking,
  spriteKeyIndices?: Uint8Array,
): { customdataChanged: boolean; visualsChanged: boolean } {
  let customdataChanged = false;
  let visualsChanged = false;

  if (culled?.[index]) {
    if (sizes[index] !== 0) {
      sizes[index] = 0;
      visualsChanged = true;
    }
    if (opacities[index] !== 0) {
      opacities[index] = 0;
      visualsChanged = true;
    }
    syncVisibleRenderIndex(index, sizes[index], opacities[index], visibleTracking);
    return { customdataChanged, visualsChanged };
  }

  const point = timeline.displayPoints[index];
  if (point.fadeEndHour !== null && clampedPlayhead >= point.fadeEndHour) {
    if (culled) culled[index] = 1;
    if (sizes[index] !== 0) {
      sizes[index] = 0;
      visualsChanged = true;
    }
    if (opacities[index] !== 0) {
      opacities[index] = 0;
      visualsChanged = true;
    }
    syncVisibleRenderIndex(index, sizes[index], opacities[index], visibleTracking);
    return { customdataChanged, visualsChanged };
  }

  const baseSize = markerSizeAt(point, clampedPlayhead);
  const sessions = pulseClock.overlaySessions;
  const overlayLocked = sessions
    && sessions.lockedRadius[index] > 0
    && isOverlaySessionActive(sessions, index, pulseClock.phaseMs);
  const visual = deadlineMarkerVisual(
    point,
    clampedPlayhead,
    pulseClock,
    overlayLocked ? sessions!.lockedRadius[index] : baseSize,
    index,
  );
  if (sizes[index] !== visual.size) {
    sizes[index] = visual.size;
    visualsChanged = true;
  }
  if (opacities[index] !== visual.opacity) {
    opacities[index] = visual.opacity;
    visualsChanged = true;
  }
  const nextColor = baseSize > 0
    ? markerColorAtPlayhead(point, clampedPlayhead, pulseClock, index)
    : WITHIN_DEADLINE_COLOR;
  if (colors[index] !== nextColor) {
    colors[index] = nextColor;
    const isPast = nextColor === PAST_DEADLINE_COLOR;
    if (spriteKeyIndices) {
      spriteKeyIndices[index] = requestFlowSpriteIndex(point.shapeIndex, isPast);
    }
    const pastDueFlags = (visibleTracking as { pastDue?: Uint8Array } | undefined)?.pastDue;
    if (pastDueFlags) {
      pastDueFlags[index] = isPast ? 1 : 0;
    }
    visualsChanged = true;
  }
  const deadlineLabel = deadlineLabelAtPlayhead(point, clampedPlayhead, pulseClock, index);
  if (customdata[index]?.[3] !== deadlineLabel) {
    if (customdata[index]) {
      customdata[index][3] = deadlineLabel;
    } else {
      customdata[index] = [
        point.customdata[0],
        point.customdata[1],
        point.customdata[2],
        deadlineLabel,
      ];
    }
    customdataChanged = true;
  }

  syncVisibleRenderIndex(index, sizes[index], opacities[index], visibleTracking);
  return { customdataChanged, visualsChanged };
}

/** Reuses caller buffers to avoid per-frame allocations during playback. */
export function updateRequestFlowMarkers(
  timeline: RequestFlowTimeline,
  playheadMs: number,
  sizes: number[],
  colors: string[],
  opacities: number[],
  customdata: [string, string, string, string][],
  culled?: Uint8Array,
  clock?: RequestFlowPulseClock,
  scope: RequestFlowMarkerUpdateScope = 'all',
  previousPlayheadMs?: number,
  visibleTracking?: VisibleRenderTracking,
): RequestFlowMarkerUpdate {
  const clampedPlayhead = Math.max(timeline.startMs, Math.min(playheadMs, timeline.endMs));
  const pulseClock = clock ?? { phaseMs: 0, playing: false };
  const spriteKeys = (visibleTracking as { spriteKeyIndices?: Uint8Array } | undefined)?.spriteKeyIndices;
  let customdataChanged = false;
  let visualsChanged = false;
  const changedIndices: number[] = [];

  const mergeUpdate = (
    index: number,
    result: { customdataChanged: boolean; visualsChanged: boolean },
  ) => {
    customdataChanged ||= result.customdataChanged;
    if (result.visualsChanged) {
      visualsChanged = true;
      changedIndices.push(index);
    }
  };

  if (scope === 'all') {
    if (visibleTracking) {
      visibleTracking.visibleIndices.length = 0;
      visibleTracking.visibleIndexSlots.fill(-1);
      visibleTracking.screenValid?.fill(0);
    }
    for (let index = 0; index < timeline.displayPoints.length; index += 1) {
      mergeUpdate(index, applyMarkerUpdateAtIndex(
        timeline,
        index,
        clampedPlayhead,
        sizes,
        colors,
        opacities,
        customdata,
        culled,
        pulseClock,
        visibleTracking,
        spriteKeys,
      ));
    }
    return { customdataChanged, visualsChanged, changedIndices };
  }

  const priorPlayhead = previousPlayheadMs ?? clampedPlayhead;
  const activeScratch = (visibleTracking as { activeScratch?: Uint8Array } | undefined)?.activeScratch;
  const activeList: number[] = [];
  const indices = activeScratch
    ? (activeIndicesForPlayheadStepScratch(timeline, priorPlayhead, clampedPlayhead, activeScratch, activeList), activeList)
    : activeIndicesForPlayheadStep(timeline, priorPlayhead, clampedPlayhead);
  const activeSet = activeScratch ? null : new Set<number>(indices);

  for (let listIndex = 0; listIndex < indices.length; listIndex += 1) {
    const index = indices[listIndex];
    mergeUpdate(index, applyMarkerUpdateAtIndex(
      timeline,
      index,
      clampedPlayhead,
      sizes,
      colors,
      opacities,
      customdata,
      culled,
      pulseClock,
      visibleTracking,
      spriteKeys,
    ));
  }

  const reconcileIndices = reconcileIndicesForPlayheadStep(timeline, priorPlayhead, clampedPlayhead);
  for (let listIndex = 0; listIndex < reconcileIndices.length; listIndex += 1) {
    const index = reconcileIndices[listIndex];
    if (activeSet ? activeSet.has(index) : activeScratch![index] === 1) continue;
    if (!markerNeedsReconcile(
      timeline,
      index,
      clampedPlayhead,
      sizes,
      colors,
      opacities,
      culled,
      pulseClock,
    )) {
      continue;
    }
    mergeUpdate(index, applyMarkerUpdateAtIndex(
      timeline,
      index,
      clampedPlayhead,
      sizes,
      colors,
      opacities,
      customdata,
      culled,
      pulseClock,
      visibleTracking,
      spriteKeys,
    ));
  }

  if (activeScratch) {
    for (let i = 0; i < indices.length; i += 1) {
      activeScratch[indices[i]] = 0;
    }
  }

  return { customdataChanged, visualsChanged, changedIndices };
}

/** Indices processed per frame during a chunked full sync. */
export const REQUEST_FLOW_CHUNKED_SYNC_SIZE = 16_384;

export interface ChunkedMarkerSyncState {
  cursor: number;
  playheadMs: number;
  pulseClock: RequestFlowPulseClock;
}

/** Processes the next chunk of a full marker sync — spreads O(n) scrub work across frames. */
export function advanceChunkedMarkerSync(
  timeline: RequestFlowTimeline,
  state: ChunkedMarkerSyncState,
  buffers: RequestFlowMarkerBuffers,
  culled?: Uint8Array,
): { done: boolean; visualsChanged: boolean } {
  const clampedPlayhead = Math.max(timeline.startMs, Math.min(state.playheadMs, timeline.endMs));
  const end = Math.min(state.cursor + REQUEST_FLOW_CHUNKED_SYNC_SIZE, timeline.geometry.count);
  let visualsChanged = false;

  if (state.cursor === 0) {
    buffers.visibleIndices.length = 0;
    buffers.visibleIndexSlots.fill(-1);
    buffers.screenValid.fill(0);
  }

  for (let index = state.cursor; index < end; index += 1) {
    const result = applyMarkerUpdateAtIndex(
      timeline,
      index,
      clampedPlayhead,
      buffers.sizes,
      buffers.colors,
      buffers.opacities,
      buffers.customdata,
      culled,
      state.pulseClock,
      buffers,
      buffers.spriteKeyIndices,
    );
    visualsChanged ||= result.visualsChanged;
  }

  state.cursor = end;
  return { done: end >= timeline.geometry.count, visualsChanged };
}

/** Unions hour buckets without allocating a Set — uses caller-owned scratch. */
export function activeIndicesForPlayheadStepScratch(
  timeline: RequestFlowTimeline,
  previousPlayheadMs: number,
  playheadMs: number,
  scratch: Uint8Array,
  out: number[],
): number {
  out.length = 0;
  const endHour = hourIndexAt(timeline, playheadMs);
  const startHour = playheadMs <= previousPlayheadMs
    ? endHour
    : hourIndexAt(timeline, previousPlayheadMs);

  for (let hour = startHour; hour <= endHour; hour += 1) {
    const bucket = timeline.activeHourIndices[hour];
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i += 1) {
      const index = bucket[i];
      if (scratch[index]) continue;
      scratch[index] = 1;
      out.push(index);
    }
  }

  return out.length;
}

/** Lists markers that should render on the DOM wiggle overlay this frame. */
export function collectRequestFlowWiggleDots(
  timeline: RequestFlowTimeline,
  playheadMs: number,
  _sizes: number[],
  clock: RequestFlowPulseClock,
): RequestFlowWiggleDot[] {
  if (!clock.playing || !clock.overlaySessions) return [];

  const sessions = clock.overlaySessions;
  const dots: RequestFlowWiggleDot[] = [];
  const candidates = new Set<number>();
  const clampedPlayhead = Math.max(timeline.startMs, Math.min(playheadMs, timeline.endMs));

  const active = activeIndicesForPlayhead(timeline, clampedPlayhead);
  for (let i = 0; i < active.length; i += 1) {
    candidates.add(active[i]);
  }
  for (let index = 0; index < timeline.displayPoints.length; index += 1) {
    if (sessions.sessionStartMs[index] > 0) candidates.add(index);
  }

  for (const index of candidates) {
    if (!isOverlaySessionActive(sessions, index, clock.phaseMs)) continue;

    const point = timeline.displayPoints[index];
    const radius = sessions.lockedRadius[index];
    if (radius <= 0) continue;

    const visual = overlayVisualFromSession(sessions, index, clock.phaseMs);
    dots.push({
      index,
      lon: point.lon,
      lat: point.lat,
      diameterPx: radius * 2,
      color: visual.color,
      offsetX: visual.offsetX,
      shapeIcon: point.shapeIcon,
    });
  }

  return dots;
}

/** HUD fields derived from the unsampled timeline at a playhead. */
export function requestFlowHudAt(timeline: RequestFlowTimeline, playheadMs: number) {
  const clampedPlayhead = Math.max(timeline.startMs, Math.min(playheadMs, timeline.endMs));
  const hourIndex = hourIndexAt(timeline, clampedPlayhead);

  return {
    hourIndex,
    label: timeline.dayLabelByHourIndex[hourIndex],
    filedCount: timeline.filedRolling24[hourIndex],
    resolvedCount: timeline.resolvedRolling24[hourIndex],
    openCount: openCountAtPlayhead(timeline, clampedPlayhead),
  };
}

function buildDisplayPoint(
  row: ProcessedRequest,
  timing: ReturnType<typeof flowTimingFromRow>,
): FlowDisplayPoint {
  const shapeIcon = categoryShapeIcon(row.category);
  return {
    lat: row.LATITUDE!,
    lon: row.LONGITUDE!,
    customdata: [row.category, row.SERVICECODEDESCRIPTION, row.WARD ?? '', 'Within deadline'],
    shapeIcon,
    shapeIndex: REQUEST_FLOW_SHAPE_ICON_INDEX[shapeIcon] ?? 0,
    filedHour: timing.filedHour,
    resolvedHour: timing.resolvedHour,
    dueHourMs: dueHourFromRow(row),
    fadeStartHour: timing.fadeStartHour,
    fadeEndHour: timing.fadeStartHour !== null ? timing.fadeStartHour + FADE_OUT_MS : null,
  };
}

/** Uniform hourly buckets — O(1) index from playhead. */
export function hourIndexAt(timeline: RequestFlowTimeline, playheadMs: number): number {
  if (timeline.hourCount === 0) return 0;
  if (playheadMs <= timeline.startMs) return 0;

  const last = timeline.hourCount - 1;
  if (playheadMs >= timeline.endMs) return last;

  return Math.min(last, Math.floor((playheadMs - timeline.startMs) / HOUR_MS));
}

/** Indexes rows for hourly playback; map markers use geocoded rows only. */
export function prepareRequestFlowTimeline(rows: ProcessedRequest[]): RequestFlowTimelineResult {
  const stats: FlowStat[] = [];
  const displayPoints: FlowDisplayPoint[] = [];
  const filedByHour = new Map<number, number>();
  const resolvedByHour = new Map<number, number>();
  let minHourKey = Number.POSITIVE_INFINITY;
  let maxHourKey = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const timing = flowTimingFromRow(row);
    stats.push({ filedHour: timing.filedHour, fadeStartHour: timing.fadeStartHour });
    incrementHourCount(filedByHour, timing.filedHour);
    if (timing.resolvedHour !== null) {
      incrementHourCount(resolvedByHour, timing.resolvedHour);
    }
    minHourKey = Math.min(minHourKey, timing.filedHour);
    maxHourKey = Math.max(maxHourKey, timing.maxHourKey);

    if (row.LATITUDE === null || row.LONGITUDE === null) continue;
    displayPoints.push(buildDisplayPoint(row, timing));
  }

  if (displayPoints.length === 0) {
    return { hasData: false };
  }

  const startMs = minHourKey;
  const endMs = maxHourKey;
  const hourCount = Math.floor((endMs - startMs) / HOUR_MS) + 1;
  if (hourCount <= 0) {
    return { hasData: false };
  }

  const openCountLookup = buildOpenCountLookup(stats);
  const geometry = buildRequestFlowGeometry(displayPoints);
  const spatialIndex = buildRequestFlowSpatialIndex(geometry);

  return {
    hasData: true,
    timeline: {
      displayPoints,
      geometry,
      spatialIndex,
      activeHourIndices: buildActiveHourIndices(displayPoints, startMs, endMs, hourCount),
      reconcileHourIndices: buildReconcileHourIndices(displayPoints, startMs, hourCount),
      startMs,
      endMs,
      hourCount,
      dayLabelByHourIndex: buildDayLabelByHourIndex(startMs, hourCount),
      scrubStartLabel: formatHourLabel(new Date(startMs)),
      scrubEndLabel: formatHourLabel(new Date(endMs)),
      openCountTimes: openCountLookup.times,
      openCountTotals: openCountLookup.totals,
      filedRolling24: buildRolling24Counts(hourCount, startMs, filedByHour),
      resolvedRolling24: buildRolling24Counts(hourCount, startMs, resolvedByHour),
    },
  };
}

/** Converts scrubber index to playhead timestamp. */
export function playheadFromHourIndex(timeline: RequestFlowTimeline, hourIndex: number): number {
  const clamped = Math.max(0, Math.min(hourIndex, timeline.hourCount - 1));
  return timeline.startMs + clamped * HOUR_MS;
}

/** Converts playhead timestamp to scrubber index. */
export function hourIndexFromPlayhead(timeline: RequestFlowTimeline, playheadMs: number): number {
  return hourIndexAt(timeline, playheadMs);
}
