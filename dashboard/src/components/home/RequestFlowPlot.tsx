import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RequestFlowTimeline, RequestFlowWiggleDot } from '../../lib/homeRequestFlowMap';
import { RequestFlowCanvasOverlay } from '../../lib/requestFlowCanvasOverlay';
import {
  formatRequestFlowHoverHtml,
  REQUEST_FLOW_MAP_STYLE,
  type RequestFlowMarkerBuffers,
} from '../../lib/requestFlowMapLayers';
import {
  bindRequestFlowMapInteraction,
  configureRequestFlowBasemap,
  type RequestFlowMapView,
} from '../../lib/requestFlowMapStyle';
import { RequestFlowWiggleOverlay } from '../../lib/requestFlowWiggleOverlay';

export interface RequestFlowPlotHandle {
  paintMarkers: (wiggleHidden?: ReadonlySet<number>) => void;
  syncWiggleOverlay: (
    dots: RequestFlowWiggleDot[],
    handoff?: readonly RequestFlowWiggleDot[],
    repaintCanvas?: boolean,
  ) => void;
}

interface RequestFlowPlotProps {
  timeline: RequestFlowTimeline;
  height: number;
  isMobile: boolean;
  mapView: RequestFlowMapView;
  plotRef: React.MutableRefObject<RequestFlowPlotHandle | null>;
  markerBuffersRef: React.MutableRefObject<RequestFlowMarkerBuffers | null>;
  suspendUpdatesRef: React.MutableRefObject<boolean>;
  onMapInteractionStart?: () => void;
  onMapInteractionEnd?: () => void;
  onMapReady?: () => void;
}

/** MapLibre basemap with canvas markers — spatial index + render budget. */
export default function RequestFlowPlot({
  timeline,
  height,
  isMobile,
  mapView,
  plotRef,
  markerBuffersRef,
  suspendUpdatesRef,
  onMapInteractionStart,
  onMapInteractionEnd,
  onMapReady,
}: RequestFlowPlotProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const mapReadyRef = useRef(false);
  const timelineRef = useRef(timeline);
  const wiggleOverlayRef = useRef<RequestFlowWiggleOverlay | null>(null);
  const markerRendererRef = useRef<RequestFlowCanvasOverlay | null>(null);
  const wiggleHiddenRef = useRef<ReadonlySet<number>>(new Set());
  const wiggleHiddenScratchRef = useRef<Set<number>>(new Set());
  const mapMoveRafRef = useRef(0);
  const isMobileRef = useRef(isMobile);
  const onMapReadyRef = useRef(onMapReady);
  const onMapInteractionStartRef = useRef(onMapInteractionStart);
  const onMapInteractionEndRef = useRef(onMapInteractionEnd);
  const mapViewRef = useRef(mapView);
  const appliedMapViewKeyRef = useRef<string | null>(null);
  timelineRef.current = timeline;
  isMobileRef.current = isMobile;
  mapViewRef.current = mapView;
  onMapReadyRef.current = onMapReady;
  onMapInteractionStartRef.current = onMapInteractionStart;
  onMapInteractionEndRef.current = onMapInteractionEnd;

  useEffect(() => {
    wiggleOverlayRef.current?.clear();
    const map = mapRef.current;
    const buffers = markerBuffersRef.current;
    if (!map || !mapReadyRef.current || !buffers || !markerRendererRef.current) return;
    markerRendererRef.current.paint(
      map,
      timeline.geometry,
      timeline.spatialIndex,
      buffers,
      wiggleHiddenRef.current,
    );
  }, [timeline, markerBuffersRef]);

  useEffect(() => {
    let cancelled = false;
    const container = mapContainerRef.current;
    if (!container) return undefined;

    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !mapContainerRef.current || !shellRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: REQUEST_FLOW_MAP_STYLE,
        center: [mapViewRef.current.lon, mapViewRef.current.lat],
        zoom: mapViewRef.current.zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });

      mapRef.current = map;
      wiggleOverlayRef.current = new RequestFlowWiggleOverlay(shellRef.current);
      markerRendererRef.current = new RequestFlowCanvasOverlay(shellRef.current);

      const repaintMarkers = (wiggleHidden?: ReadonlySet<number>) => {
        if (wiggleHidden) wiggleHiddenRef.current = wiggleHidden;
        const buffers = markerBuffersRef.current;
        const renderer = markerRendererRef.current;
        if (!buffers || !renderer || suspendUpdatesRef.current) return;
        renderer.paint(
          map,
          timelineRef.current.geometry,
          timelineRef.current.spatialIndex,
          buffers,
          wiggleHiddenRef.current,
        );
      };

      const scheduleRepaintMarkers = () => {
        if (mapMoveRafRef.current) return;
        mapMoveRafRef.current = requestAnimationFrame(() => {
          mapMoveRafRef.current = 0;
          repaintMarkers();
          wiggleOverlayRef.current?.reposition(map);
        });
      };

      map.on('move', scheduleRepaintMarkers);
      map.on('movestart', () => {
        if (isMobileRef.current) hideTooltip();
      });

      map.on('load', () => {
        if (cancelled) return;
        configureRequestFlowBasemap(map);
        mapReadyRef.current = true;
        repaintMarkers();
        onMapReadyRef.current?.();
      });

      const unbindMapInteraction = bindRequestFlowMapInteraction(map, {
        onStart: () => onMapInteractionStartRef.current?.(),
        onEnd: () => onMapInteractionEndRef.current?.(),
      });

      const tooltip = tooltipRef.current;
      const hideTooltip = () => tooltip?.classList.add('hidden');

      const updateTooltipAtPoint = (x: number, y: number): boolean => {
        if (!tooltip || suspendUpdatesRef.current) {
          hideTooltip();
          return false;
        }
        const buffers = markerBuffersRef.current;
        const renderer = markerRendererRef.current;
        if (!buffers || !renderer) {
          hideTooltip();
          return false;
        }
        const hitIndex = renderer.hitTest(buffers, x, y);
        if (hitIndex === null) {
          hideTooltip();
          map.getCanvas().style.cursor = '';
          return false;
        }
        const customdata = buffers.customdata[hitIndex];
        if (!customdata || buffers.sizes[hitIndex] <= 0) {
          hideTooltip();
          map.getCanvas().style.cursor = '';
          return false;
        }
        map.getCanvas().style.cursor = 'pointer';
        tooltip.innerHTML = formatRequestFlowHoverHtml(customdata);
        tooltip.classList.remove('hidden');
        tooltip.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
        return true;
      };

      const onMouseMove = (event: MapMouseEvent) => {
        if (isMobileRef.current) return;
        updateTooltipAtPoint(event.point.x, event.point.y);
      };

      const onMapClick = (event: MapMouseEvent) => {
        if (!isMobileRef.current) return;
        updateTooltipAtPoint(event.point.x, event.point.y);
      };

      map.on('mousemove', onMouseMove);
      map.on('click', onMapClick);
      map.on('mouseleave', hideTooltip);

      plotRef.current = {
        paintMarkers: repaintMarkers,
        syncWiggleOverlay: (dots, handoff = [], repaintCanvas = true) => {
          if (!mapReadyRef.current) return;
          if (suspendUpdatesRef.current) {
            wiggleOverlayRef.current?.clear();
            return;
          }
          const hidden = wiggleHiddenScratchRef.current;
          hidden.clear();
          for (let i = 0; i < dots.length; i += 1) hidden.add(dots[i].index);
          wiggleHiddenRef.current = hidden;
          if (repaintCanvas) repaintMarkers(hidden);
          if (handoff.length > 0) {
            wiggleOverlayRef.current?.beginHandoff(map, [...handoff]);
          }
          if (dots.length > 0) {
            wiggleOverlayRef.current?.sync(map, dots);
          } else if (handoff.length === 0) {
            wiggleOverlayRef.current?.clear();
          } else {
            wiggleOverlayRef.current?.sync(map, []);
          }
        },
      };

      (map as MaplibreMap & { __requestFlowCleanup?: () => void }).__requestFlowCleanup = () => {
        unbindMapInteraction();
        map.off('mousemove', onMouseMove);
        map.off('click', onMapClick);
        map.off('mouseleave', hideTooltip);
      };
    });

    return () => {
      cancelled = true;
      if (mapMoveRafRef.current) cancelAnimationFrame(mapMoveRafRef.current);
      mapReadyRef.current = false;
      plotRef.current = null;
      wiggleOverlayRef.current?.destroy();
      markerRendererRef.current?.destroy();
      wiggleOverlayRef.current = null;
      markerRendererRef.current = null;
      const map = mapRef.current;
      if (map) {
        (map as MaplibreMap & { __requestFlowCleanup?: () => void }).__requestFlowCleanup?.();
        map.remove();
        mapRef.current = null;
      }
    };
  }, [plotRef, markerBuffersRef, suspendUpdatesRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    map.setZoom(mapView.zoom);
  }, [isMobile, mapView.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const key = `${mapView.lat},${mapView.lon},${mapView.zoom}`;
    if (appliedMapViewKeyRef.current === key) return;
    appliedMapViewKeyRef.current = key;
    map.flyTo({
      center: [mapView.lon, mapView.lat],
      zoom: mapView.zoom,
      duration: 800,
    });
  }, [mapView.lat, mapView.lon, mapView.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    map.resize();
    const buffers = markerBuffersRef.current;
    if (buffers && markerRendererRef.current) {
      markerRendererRef.current.paint(
        map,
        timeline.geometry,
        timeline.spatialIndex,
        buffers,
        wiggleHiddenRef.current,
      );
    }
    wiggleOverlayRef.current?.reposition(map);
  }, [height, timeline, markerBuffersRef]);

  return (
    <div ref={shellRef} className="relative w-full min-w-0" style={{ width: '100%', height }}>
      <div ref={mapContainerRef} className="absolute inset-0" />
      <div
        ref={tooltipRef}
        className="request-flow-map-tooltip request-flow-map-glass hidden pointer-events-none absolute left-0 top-0 z-20 px-2.5 py-2 text-[11px] leading-snug text-gray-900"
      />
    </div>
  );
}
