/** Plain-language chip labels keyed by canonical service type name. */
const QUICK_PICK_DISPLAY_LABELS: Record<string, string> = {
  Pothole: 'Pothole',
  'Bulk Collection': 'Bulk trash pickup',
  'Parking Enforcement': 'Parking enforcement',
  'Scheduled Yard Waste': 'Yard waste',
  'Sidewalk Repair': 'Sidewalk repair',
  'Bicycle Services': 'Bike services',
  'Bus Stop Issues': 'Bus stop',
  'Illegal Dumping': 'Illegal dumping',
};

/** Returns a short chip label while preserving the full service type in URLs. */
export function quickPickDisplayLabel(serviceType: string): string {
  return QUICK_PICK_DISPLAY_LABELS[serviceType] ?? serviceType;
}
