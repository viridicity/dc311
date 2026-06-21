import type { Map as MaplibreMap } from 'maplibre-gl';
import { markerScreenRadius } from './requestFlowMarkerScale';

export interface RequestFlowWiggleDot {
  index: number;
  lon: number;
  lat: number;
  diameterPx: number;
  color: string;
  offsetX: number;
  shapeIcon: string;
}

/** DOM layer for deadline wiggle — CSS transforms animate on the compositor, not via GeoJSON. */
export class RequestFlowWiggleOverlay {
  private readonly container: HTMLDivElement;
  private readonly dots = new Map<number, HTMLDivElement>();
  private active = new Set<number>();
  private handoffPending = new Set<number>();
  private lastDots: RequestFlowWiggleDot[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'request-flow-wiggle-overlay';
    this.container.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.container);
  }

  /** Repositions dots from the last sync — call after map pan/zoom. */
  reposition(map: MaplibreMap): void {
    if (this.lastDots.length === 0) return;
    this.paint(map, this.lastDots);
  }

  sync(map: MaplibreMap, dots: RequestFlowWiggleDot[]): void {
    this.lastDots = dots;
    this.paint(map, dots);
  }

  /** Fades out settled dots while the map marker underneath takes over. */
  beginHandoff(map: MaplibreMap, dots: RequestFlowWiggleDot[]): void {
    for (let i = 0; i < dots.length; i += 1) {
      const dot = dots[i];
      if (this.handoffPending.has(dot.index)) continue;
      this.handoffPending.add(dot.index);
      this.active.delete(dot.index);

      let element = this.dots.get(dot.index);
      if (!element) {
        element = document.createElement('div');
        element.className = 'request-flow-wiggle-dot';
        this.dots.set(dot.index, element);
        this.container.appendChild(element);
      }

      element.classList.remove('request-flow-wiggle-dot--handoff');
      this.positionDot(element, map, { ...dot, offsetX: 0 });

      const finish = () => {
        element?.remove();
        this.dots.delete(dot.index);
        this.handoffPending.delete(dot.index);
      };

      requestAnimationFrame(() => {
        element?.classList.add('request-flow-wiggle-dot--handoff');
        element?.addEventListener('transitionend', finish, { once: true });
        window.setTimeout(finish, 140);
      });
    }
  }

  clear(): void {
    this.lastDots = [];
    for (const index of this.handoffPending) {
      this.dots.get(index)?.remove();
      this.dots.delete(index);
    }
    this.handoffPending.clear();
    for (const index of this.active) {
      this.dots.get(index)?.remove();
      this.dots.delete(index);
    }
    this.active.clear();
  }

  destroy(): void {
    this.clear();
    this.container.remove();
  }

  private paint(map: MaplibreMap, dots: RequestFlowWiggleDot[]): void {
    const nextActive = new Set<number>();

    for (let i = 0; i < dots.length; i += 1) {
      const dot = dots[i];
      nextActive.add(dot.index);

      let element = this.dots.get(dot.index);
      if (!element) {
        element = document.createElement('div');
        element.className = 'request-flow-wiggle-dot';
        this.dots.set(dot.index, element);
        this.container.appendChild(element);
      }

      this.positionDot(element, map, dot);
    }

    for (const index of this.active) {
      if (nextActive.has(index)) continue;
      if (this.handoffPending.has(index)) continue;
      this.dots.get(index)?.remove();
      this.dots.delete(index);
    }

    this.active = nextActive;
  }

  private positionDot(
    element: HTMLDivElement,
    map: MaplibreMap,
    dot: RequestFlowWiggleDot,
  ): void {
    const projected = map.project([dot.lon, dot.lat]);
    const normalizedRadius = dot.diameterPx / 2;
    const screenRadius = markerScreenRadius(map, dot.lat, normalizedRadius);
    const diameterPx = screenRadius * 2;
    const fontPx = Math.max(7, diameterPx * 0.92);

    element.textContent = dot.shapeIcon;
    element.style.width = `${diameterPx}px`;
    element.style.height = `${diameterPx}px`;
    element.style.backgroundColor = 'transparent';
    element.style.borderRadius = '0';
    element.style.clipPath = '';
    element.style.border = '';
    element.style.color = dot.color;
    element.style.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    element.style.lineHeight = `${diameterPx}px`;
    element.style.textAlign = 'center';
    element.style.opacity = '1';
    element.style.transform =
      `translate3d(${projected.x - screenRadius + dot.offsetX}px, ${projected.y - screenRadius}px, 0)`;
  }
}
