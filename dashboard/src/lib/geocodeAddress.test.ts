import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatMarAddressLabel,
  geocodeDcAddress,
  searchDcAddressCandidates,
} from './geocodeAddress';

function mockFetchResponse(candidates: unknown[]) {
  return {
    ok: true,
    json: async () => ({ candidates }),
  } as Response;
}

describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('formats MAR labels for display', () => {
    expect(formatMarAddressLabel('1600 PENNSYLVANIA AVENUE NW')).toBe(
      '1600 Pennsylvania Avenue NW',
    );
  });

  it('returns coordinates for a valid DC candidate', async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse([{
      address: '1234 H STREET NE',
      score: 100,
      location: { x: -76.99, y: 38.9 },
    }]));

    const result = await geocodeDcAddress('1234 H St NE');
    expect(result).toEqual({
      lat: 38.9,
      lon: -76.99,
      label: '1234 H Street NE',
      score: 100,
    });
  });

  it('returns multiple ranked candidates', async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse([
      {
        address: '1234 H STREET NE',
        score: 95,
        location: { x: -76.99, y: 38.9 },
      },
      {
        address: '1236 H STREET NE',
        score: 88,
        location: { x: -76.991, y: 38.901 },
      },
    ]));

    const results = await searchDcAddressCandidates('1234 H St NE');
    expect(results).toHaveLength(2);
    expect(results[0]?.score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
  });

  it('merges results from unit-stripped query variants', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = decodeURIComponent(String(input).replace(/\+/g, ' '));
      if (url.includes('1234 H St NE')) {
        return mockFetchResponse([{
          address: '1234 H STREET NE',
          score: 100,
          location: { x: -76.99, y: 38.9 },
        }]);
      }
      return mockFetchResponse([]);
    });

    const results = await searchDcAddressCandidates('1234 H St NE Apt 2');
    expect(results).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns null when no candidates match', async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse([]));

    expect(await geocodeDcAddress('not a real place')).toBeNull();
  });

  it('filters low scores and out-of-bounds coordinates', async () => {
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse([
      {
        address: 'LOW SCORE',
        score: 50,
        location: { x: -76.99, y: 38.9 },
      },
      {
        address: 'NEW YORK NY',
        score: 100,
        location: { x: -74.0, y: 40.7 },
      },
    ]));

    expect(await searchDcAddressCandidates('123 Broadway')).toEqual([]);
  });
});
