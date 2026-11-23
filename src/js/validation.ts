/**
 * Shared pure text and schema validation utilities used across forms,
 * logic modules, localStorage hydration, and server routes.
 */

// Rejects all ASCII C0/DEL control chars; optionally allows CR/LF for multi-line textareas.
const SINGLE_LINE_CONTROL_RE = /[\u0000-\u001f\u007f]/;
const MULTI_LINE_CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function hasControlChars(value: string, allowNewlines = false): boolean {
  return allowNewlines
    ? MULTI_LINE_CONTROL_RE.test(value)
    : SINGLE_LINE_CONTROL_RE.test(value);
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

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

export function addDaysIso(isoDate: string, offsetDays: number): string {
  const dt = parseIsoDateUtc(isoDate);
  if (!dt) return isoDate;
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDateUtc(value) !== null;
}

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
