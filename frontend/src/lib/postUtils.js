/**
 * Shared helpers for lost/found/rescue/adoption post cards.
 */

/**
 * Normalize a post's `images` field (JSONB string, array, or null) into an array.
 */
export function parseImages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

/**
 * Format a date as short "Mon D". Returns '' for falsy input — caller supplies
 * its own fallback label (e.g. an i18n "unknown" string).
 */
export function formatShortDate(dateStr, locale = "en-US") {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(locale, { month: "short", day: "numeric" });
}
