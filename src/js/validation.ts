/**
 * Shared pure text and schema validation utilities used across forms,
 * logic modules, localStorage hydration, and server routes.
 */

// Rejects all ASCII C0/DEL control chars; optionally allows CR/LF for multi-line textareas.
const SINGLE_LINE_CONTROL_RE = /[\u0000-\u001f\u007f]/;
const MULTI_LINE_CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Checks whether a string contains disallowed ASCII control characters.
 *
 * @param value - Input string to inspect.
 * @param allowNewlines - Whether CR/LF newlines are permitted (for multi-line fields).
 * @returns True if disallowed control characters are present.
 */
export function hasControlChars(value: string, allowNewlines = false): boolean {
  return allowNewlines
    ? MULTI_LINE_CONTROL_RE.test(value)
    : SINGLE_LINE_CONTROL_RE.test(value);
}

/**
 * Trims surrounding whitespace and collapses internal whitespace runs to single spaces.
 *
 * @param value - Raw user or model text.
 * @returns Normalized single-spaced string.
 */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Parses an ISO calendar date (`YYYY-MM-DD`) strictly in UTC, rejecting calendar rollovers.
 *
 * @param value - Candidate date string.
 * @returns Valid UTC Date instance at 00:00:00Z, or null when invalid.
 */
export function parseIsoDateUtc(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [y, m, d] = value.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

/**
 * Shifts a valid ISO date (`YYYY-MM-DD`) by a signed number of UTC days.
 *
 * @param isoDate - Base ISO date string.
 * @param offsetDays - Signed day offset to add.
 * @returns Shifted `YYYY-MM-DD` string, or original input if invalid.
 */
export function addDaysIso(isoDate: string, offsetDays: number): string {
  const dt = parseIsoDateUtc(isoDate);
  if (!dt) return isoDate;
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Checks whether a string is a valid calendar `YYYY-MM-DD` date.
 *
 * @param value - Candidate ISO date string.
 * @returns True when the string parses to a real calendar date.
 */
export function isValidIsoDate(value: string): boolean {
  return parseIsoDateUtc(value) !== null;
}

/**
 * Type guard verifying a string contains no control characters and falls within length bounds.
 *
 * @param value - Unknown candidate value.
 * @param minLen - Minimum normalized character length.
 * @param maxLen - Maximum normalized character length.
 * @param allowNewlines - Whether CR/LF newlines are permitted.
 * @returns True when `value` is a clean string within bounds.
 */
export function isSafeString(
  value: unknown,
  minLen: number,
  maxLen: number,
  allowNewlines = false
): value is string {
  if (typeof value !== 'string') return false;
  if (hasControlChars(value, allowNewlines)) return false;
  const cleaned = normalizeText(value);
  return cleaned.length >= minLen && cleaned.length <= maxLen;
}
