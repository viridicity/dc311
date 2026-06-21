import type { Map as MaplibreMap } from 'maplibre-gl';

/** Pixel size of generated glyph textures. */
export const REQUEST_FLOW_SHAPE_ICON_PX = 64;

/** Normalized marker radius used by playback animations (converted to ground size at paint). */
export const REQUEST_FLOW_MARKER_RADIUS_PX = 6;

export const REQUEST_FLOW_SHAPE_ICON_SIZE =
  (REQUEST_FLOW_MARKER_RADIUS_PX * 2) / REQUEST_FLOW_SHAPE_ICON_PX;

/** Monospace glyphs with similar visual weight — one per legend category. */
export const REQUEST_FLOW_CATEGORY_ASCII: Readonly<Record<string, string>> = {
  'Pedestrian Infrastructure': '@',
  'Roads & Vehicle Infrastructure': '#',
  'Traffic Safety': '$',
  'Cycling & Micromobility': '%',
  'Transit': '&',
  'Sanitation & Dumping': '*',
  'Waste & Recycling': '+',
  'Parking & Vehicles': '=',
  'Trees & Canopy': '?',
  'Rodent Control': '~',
  'Public Space & Parks': '^',
  'Buildings & Safety': '!',
  'Environment': '/',
  'Snow & Winter': '0',
  'DMV & Vehicles': 'π',
  'City Services & Info': ';',
  Other: 'x',
};

/** @deprecated Use REQUEST_FLOW_CATEGORY_ASCII — kept for existing imports. */
export const REQUEST_FLOW_CATEGORY_SHAPE = REQUEST_FLOW_CATEGORY_ASCII;

const DEFAULT_ASCII = REQUEST_FLOW_CATEGORY_ASCII.Other;

/** Sample glyph for on-time / past-deadline legend rows (color carries the meaning). */
export const REQUEST_FLOW_DEADLINE_LEGEND_GLYPH = '@';

export const REQUEST_FLOW_ASCII_FONT =
  '600 48px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/** Returns the display glyph for a request category. */
export function categoryShapeIcon(category: string): string {
  return REQUEST_FLOW_CATEGORY_ASCII[category] ?? DEFAULT_ASCII;
}

/** Categories that appear in the HUD shape legend, in display order. */
export const REQUEST_FLOW_LEGEND_CATEGORIES = [
  'Pedestrian Infrastructure',
  'Roads & Vehicle Infrastructure',
  'Traffic Safety',
  'Cycling & Micromobility',
  'Transit',
  'Sanitation & Dumping',
  'Waste & Recycling',
  'Parking & Vehicles',
  'Trees & Canopy',
  'Rodent Control',
  'Public Space & Parks',
  'Buildings & Safety',
  'Environment',
  'Snow & Winter',
  'DMV & Vehicles',
  'City Services & Info',
  'Other',
] as const;

const UNIQUE_ASCII_CHARS = [...new Set(Object.values(REQUEST_FLOW_CATEGORY_ASCII))];

/** Stable index for each category glyph — used for O(1) sprite lookup. */
export const REQUEST_FLOW_SHAPE_ICON_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  UNIQUE_ASCII_CHARS.map((glyph, index) => [glyph, index]),
);

/** Returns the glyph for a shape index. */
export function requestFlowAsciiChar(shapeIndex: number): string {
  return UNIQUE_ASCII_CHARS[shapeIndex] ?? DEFAULT_ASCII;
}

/** Wiggle overlay uses the same monospace glyph styling as the map layer. */
export function wiggleDotShapeStyle(shapeIcon: string): {
  borderRadius: string;
  clipPath: string;
  glyph: string;
} {
  return { borderRadius: '0', clipPath: 'none', glyph: shapeIcon };
}

/** Default marker blue — category legend swatches match on-map fill color. */
export const REQUEST_FLOW_SHAPE_LEGEND_COLOR = '#2563EB';

export type RequestFlowSpriteColor = 'blue' | 'orange';

const SPRITE_BLUE = '#2563EB';
const SPRITE_ORANGE = '#e67e22';

function buildAsciiSprite(glyph: string, color: string): HTMLCanvasElement {
  const size = REQUEST_FLOW_SHAPE_ICON_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = REQUEST_FLOW_ASCII_FONT;
  ctx.fillText(glyph, size / 2, size / 2 + 1);

  return normalizeGlyphCanvas(canvas, size * 0.72);
}

function normalizeGlyphCanvas(source: HTMLCanvasElement, targetDiameter: number): HTMLCanvasElement {
  const size = source.width;
  const ctx = source.getContext('2d');
  if (!ctx) return source;

  const bounds = alphaBounds(ctx.getImageData(0, 0, size, size));
  if (!bounds) return source;

  const contentW = bounds.maxX - bounds.minX + 1;
  const contentH = bounds.maxY - bounds.minY + 1;
  const contentSize = Math.max(contentW, contentH);
  if (contentSize <= 0) return source;

  const scale = targetDiameter / contentSize;
  const destW = contentW * scale;
  const destH = contentH * scale;

  const dest = document.createElement('canvas');
  dest.width = size;
  dest.height = size;
  const dctx = dest.getContext('2d');
  if (!dctx) return source;

  dctx.clearRect(0, 0, size, size);
  dctx.fillStyle = ctx.fillStyle;
  dctx.textAlign = 'center';
  dctx.textBaseline = 'middle';
  dctx.font = REQUEST_FLOW_ASCII_FONT;
  dctx.drawImage(
    source,
    bounds.minX,
    bounds.minY,
    contentW,
    contentH,
    size / 2 - destW / 2,
    size / 2 - destH / 2,
    destW,
    destH,
  );

  return dest;
}

function alphaBounds(imageData: ImageData): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

let requestFlowSpriteCanvases: HTMLCanvasElement[] | null = null;

/** Flat sprite list: even indices = blue, odd = orange per glyph index. */
export function getRequestFlowSpriteCanvases(): readonly HTMLCanvasElement[] {
  if (requestFlowSpriteCanvases) return requestFlowSpriteCanvases;
  const sprites: HTMLCanvasElement[] = [];
  for (const glyph of UNIQUE_ASCII_CHARS) {
    sprites.push(buildAsciiSprite(glyph, SPRITE_BLUE));
    sprites.push(buildAsciiSprite(glyph, SPRITE_ORANGE));
  }
  requestFlowSpriteCanvases = sprites;
  return sprites;
}

/** Returns the sprite canvas index for a shape and deadline state. */
export function requestFlowSpriteIndex(shapeIndex: number, pastDue: boolean): number {
  return shapeIndex * 2 + (pastDue ? 1 : 0);
}

/** Maps marker color hex to a small sprite palette key. */
export function requestFlowSpriteColorKey(color: string): RequestFlowSpriteColor {
  return color === SPRITE_ORANGE ? 'orange' : 'blue';
}

/** Pre-rendered colored glyph sprites for canvas marker drawing. */
export function buildRequestFlowShapeSpriteCache(): Map<string, HTMLCanvasElement> {
  const sprites = getRequestFlowSpriteCanvases();
  const cache = new Map<string, HTMLCanvasElement>();
  for (let shapeIndex = 0; shapeIndex < UNIQUE_ASCII_CHARS.length; shapeIndex += 1) {
    const glyph = UNIQUE_ASCII_CHARS[shapeIndex];
    cache.set(`${glyph}:blue`, sprites[shapeIndex * 2]);
    cache.set(`${glyph}:orange`, sprites[shapeIndex * 2 + 1]);
  }
  return cache;
}

const swatchDataUrlCache = new Map<string, string>();

/** Colored legend swatch using the same glyph geometry as map markers. */
export function shapeSwatchDataUrl(
  shapeIcon: string,
  color: string,
  displayPx = 10,
): string {
  const key = `${shapeIcon}|${color}|${displayPx}`;
  const cached = swatchDataUrlCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') return '';

  const source = buildAsciiSprite(shapeIcon, color);
  const output = document.createElement('canvas');
  output.width = displayPx;
  output.height = displayPx;
  const octx = output.getContext('2d');
  if (!octx) return '';
  octx.clearRect(0, 0, displayPx, displayPx);
  octx.imageSmoothingEnabled = true;
  octx.drawImage(source, 0, 0, displayPx, displayPx);

  const url = output.toDataURL('image/png');
  if (swatchDataUrlCache.size > 256) swatchDataUrlCache.clear();
  swatchDataUrlCache.set(key, url);
  return url;
}

/** No-op — legacy MapLibre SDF registration is unused by the canvas overlay. */
export function registerRequestFlowShapeImages(_map: MaplibreMap): void {}
