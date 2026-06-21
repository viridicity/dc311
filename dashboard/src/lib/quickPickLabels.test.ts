import { describe, expect, it } from 'vitest';
import { quickPickDisplayLabel } from './quickPickLabels';

describe('quickPickDisplayLabel', () => {
  it('returns plain labels for known service types', () => {
    expect(quickPickDisplayLabel('Scheduled Yard Waste')).toBe('Yard waste');
    expect(quickPickDisplayLabel('Pothole')).toBe('Pothole');
  });

  it('falls back to the service type name', () => {
    expect(quickPickDisplayLabel('Custom Service Type')).toBe('Custom Service Type');
  });
});
