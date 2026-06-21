import { REQUEST_FLOW_MAP_BOUNDS } from './requestFlowMapStyle';

/** DC Master Address Repository — authoritative for District addresses. */
const DC_MAR_GEOCODE_URL =
  'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_APPS/DCGIS_MAR/GeocodeServer/findAddressCandidates';

const MIN_CANDIDATE_SCORE = 60;
const DEFAULT_SEARCH_LIMIT = 8;

export interface GeocodeCandidate {
  lat: number;
  lon: number;
  label: string;
  score: number;
}

/** @deprecated Use GeocodeCandidate */
export type GeocodedAddress = GeocodeCandidate;

interface ArcGisCandidate {
  location?: { x?: number; y?: number };
  address?: string;
  score?: number;
}

interface ArcGisResponse {
  candidates?: ArcGisCandidate[];
}

function isWithinDcBounds(lat: number, lon: number): boolean {
  return (
    lat >= REQUEST_FLOW_MAP_BOUNDS.south
    && lat <= REQUEST_FLOW_MAP_BOUNDS.north
    && lon >= REQUEST_FLOW_MAP_BOUNDS.west
    && lon <= REQUEST_FLOW_MAP_BOUNDS.east
  );
}

function candidateKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/** MAR returns ALL CAPS; title-case for display while keeping quadrant suffixes. */
export function formatMarAddressLabel(address: string): string {
  return address.trim().split(/\s+/).map((token) => {
    if (/^(NE|NW|SE|SW)$/i.test(token)) return token.toUpperCase();
    if (/^\d/.test(token)) return token;
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  }).join(' ');
}

/** Drops unit/apt suffixes so MAR can match the street address. */
function stripUnitSuffix(address: string): string {
  return address.replace(/\s*(?:#|apt\.?|unit|ste\.?|suite)\s*[\w-]+.*$/i, '').trim();
}

/** Builds query variants — MAR is DC-only but users often include unit numbers. */
function buildSearchQueries(address: string): string[] {
  const trimmed = address.trim();
  if (!trimmed) return [];

  const queries = new Set<string>([trimmed]);
  const withoutUnit = stripUnitSuffix(trimmed);
  if (withoutUnit && withoutUnit !== trimmed) {
    queries.add(withoutUnit);
  }
  return [...queries];
}

function parseArcGisCandidates(data: ArcGisResponse): GeocodeCandidate[] {
  const results: GeocodeCandidate[] = [];
  for (const candidate of data.candidates ?? []) {
    const lon = candidate.location?.x;
    const lat = candidate.location?.y;
    const score = candidate.score ?? 0;
    if (lon == null || lat == null || score < MIN_CANDIDATE_SCORE) continue;
    if (!isWithinDcBounds(lat, lon)) continue;
    const rawLabel = candidate.address?.trim() || 'Address in DC';
    results.push({
      lat,
      lon,
      label: formatMarAddressLabel(rawLabel),
      score,
    });
  }
  return results;
}

async function fetchMarCandidates(singleLine: string, limit: number): Promise<GeocodeCandidate[]> {
  const params = new URLSearchParams({
    f: 'json',
    singleLine,
    outFields: 'Score',
    maxLocations: String(limit),
    outSR: '4326',
  });

  const response = await fetch(`${DC_MAR_GEOCODE_URL}?${params.toString()}`);
  if (!response.ok) return [];
  const data = await response.json() as ArcGisResponse;
  return parseArcGisCandidates(data);
}

/** Returns ranked DC address matches for the user to pick from. */
export async function searchDcAddressCandidates(
  address: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Promise<GeocodeCandidate[]> {
  const queries = buildSearchQueries(address);
  if (queries.length === 0) return [];

  const batches = await Promise.all(
    queries.map((query) => fetchMarCandidates(query, limit)),
  );

  const merged = new Map<string, GeocodeCandidate>();
  for (const batch of batches) {
    for (const candidate of batch) {
      const key = candidateKey(candidate.lat, candidate.lon);
      const existing = merged.get(key);
      if (!existing || candidate.score > existing.score) {
        merged.set(key, candidate);
      }
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Returns the best match, if any — prefer searchDcAddressCandidates for profile UX. */
export async function geocodeDcAddress(address: string): Promise<GeocodeCandidate | null> {
  const candidates = await searchDcAddressCandidates(address, 1);
  return candidates[0] ?? null;
}
