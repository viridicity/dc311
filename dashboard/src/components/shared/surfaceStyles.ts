/** Shared chip styling for Home and Estimate quick picks. */
export const QUICK_PICK_CHIP_CLASS =
  'text-caption px-2.5 py-1 min-h-[32px] rounded-full border border-border bg-surface-muted hover:bg-blue-50 hover:border-blue-200 hover:text-blue-900 text-gray-800 transition-colors';

/** Ticket shortcut pills — saved tickets and recent ticket lookups. */
export const TICKET_CHIP_CLASS =
  'text-caption px-2.5 py-1 min-h-[32px] rounded-full border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-900 text-gray-800 transition-colors';

/** Split pill shell when a chip includes a remove control. */
export const TICKET_CHIP_SPLIT_CLASS = 'border-blue-200 bg-blue-50/50';
export const TYPE_CHIP_SPLIT_CLASS = 'border-border bg-surface';

/** Two pill rows tall (32px pills + 6px row gap). */
export const SHORTCUT_ROW_TWO_LINE_MAX_HEIGHT_PX = 70;

/** Primary action button — matches EstimateResultCard CTAs. */
export const PRIMARY_BUTTON_CLASS =
  'inline-flex items-center justify-center min-h-[44px] px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed';

/** Text input — matches EstimateInput field styling. */
export const SURFACE_INPUT_CLASS =
  'w-full text-body border border-border rounded-md px-3 py-2 min-h-[44px] bg-surface focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors';

/** Compact field label for profile and form panels. */
export const FIELD_LABEL_CLASS = 'block text-caption font-medium text-gray-700 mb-1.5';

/** Secondary hint under profile fields. */
export const FIELD_HINT_CLASS = 'text-xs text-gray-400 mt-1.5 mb-0';

/** Inset panel block used in Profile sections. */
export const PROFILE_INSET_CLASS =
  'rounded-lg border border-border bg-surface-muted/25 overflow-hidden divide-y divide-border';

export const PROFILE_INSET_SECTION_CLASS = 'px-3.5 py-3.5';

/** Card shell used across Estimate and Home entry surfaces. */
export const SURFACE_CARD_CLASS = 'bg-surface border border-border rounded-lg mb-2';

export const SURFACE_CARD_HEADER_CLASS = 'px-4 py-2.5 border-b border-border';

export const SURFACE_CARD_BODY_CLASS = 'font-mono px-4 py-3';
