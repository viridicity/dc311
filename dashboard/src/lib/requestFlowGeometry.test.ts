import { describe, expect, it } from 'vitest';
import { REQUEST_FLOW_MAP_BOUNDS } from './requestFlowMapStyle';
import {
  buildRequestFlowGeometry,
  buildRequestFlowSpatialIndex,
  querySpatialIndex,
} from './requestFlowGeometry';

describe('buildRequestFlowSpatialIndex', () => {
  it('indexes geocoded points at the map view bounds edge', () => {
    const geometry = buildRequestFlowGeometry([
      {
        lat: REQUEST_FLOW_MAP_BOUNDS.north - 0.001,
        lon: REQUEST_FLOW_MAP_BOUNDS.west + 0.001,
        customdata: ['Other', 'Edge case', '', 'Within deadline'],
        shapeIcon: 'x',
        shapeIndex: 0,
        filedHour: 0,
        resolvedHour: null,
        dueHourMs: null,
        fadeStartHour: null,
        fadeEndHour: null,
      },
    ]);

    const index = buildRequestFlowSpatialIndex(geometry);
    const hits: number[] = [];
    querySpatialIndex(
      index,
      REQUEST_FLOW_MAP_BOUNDS.west,
      REQUEST_FLOW_MAP_BOUNDS.south,
      REQUEST_FLOW_MAP_BOUNDS.east,
      REQUEST_FLOW_MAP_BOUNDS.north,
      hits,
    );

    expect(hits).toEqual([0]);
  });
});
