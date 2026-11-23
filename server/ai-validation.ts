/**
 * Input and AI response payload validators for server endpoints.
 */
import { LIMITS } from '../src/js/constants.ts';
import type { AllocationResult } from '../src/js/scheduler.ts';
import type { ActionResult } from '../src/js/types.ts';
import { hasControlChars, isValidIsoDate, normalizeText } from '../src/js/validation.ts';
import type { EquipmentSuggestion } from './catalog-fallback.ts';
import { stripMarkup } from './gemini-client.ts';

/**
 * Validates and normalizes the incoming `project` text for `/api/suggest-equipment`.
 *
 * @param rawProject - Unknown request body `project` property.
 * @returns `{ ok: true, value }` with normalized text, or `{ ok: false, error }`.
 */
export function validateSuggestProjectInput(rawProject: unknown): ActionResult<string> {
  if (typeof rawProject !== 'string') {
    return {
      ok: false,
      error: `Project description is required (${LIMITS.AI_PROJECT_MIN} to ${LIMITS.AI_PROJECT_MAX} characters).`,
    };
  }
  if (hasControlChars(rawProject, true)) {
    return { ok: false, error: 'Project description cannot contain control characters.' };
  }
  const project = normalizeText(rawProject);
  if (project.length < LIMITS.AI_PROJECT_MIN || project.length > LIMITS.AI_PROJECT_MAX) {
    return {
      ok: false,
      error: `Project description must be between ${LIMITS.AI_PROJECT_MIN} and ${LIMITS.AI_PROJECT_MAX} characters.`,
    };
  }
  return { ok: true, value: project };
}

/**
 * Parses, deduplicates, sanitizes, and catalog-verifies model equipment suggestion JSON.
 *
 * @param rawText - Raw JSON response text returned by Gemini.
 * @param validItemIds - Set of existing equipment IDs from the campus catalog.
 * @returns Sanitized array of verified `EquipmentSuggestion` entries.
 */
export function validateAndSanitizeSuggestions(
  rawText: string,
  validItemIds: Set<string>
): EquipmentSuggestion[] {
  const parsed = JSON.parse(rawText) as { suggestions?: unknown };
  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error('Malformed suggestions payload');
  }

  const seen = new Set<string>();
  const sanitized: EquipmentSuggestion[] = [];

  for (const entry of parsed.suggestions) {
    if (!entry || typeof entry !== 'object') continue;
    const rawId = (entry as { itemId?: unknown }).itemId;
    const rawReason = (entry as { reason?: unknown }).reason;
    if (typeof rawId !== 'string' || typeof rawReason !== 'string') continue;

    const itemId = rawId.trim();
    if (!validItemIds.has(itemId) || seen.has(itemId)) continue;

    const reason = stripMarkup(rawReason, LIMITS.AI_REASON_MAX);
    if (reason.length < LIMITS.REASON_MIN) continue;

    seen.add(itemId);
    sanitized.push({ itemId, reason });
    if (sanitized.length >= LIMITS.AI_MAX_SUGGESTIONS) break;
  }

  return sanitized;
}

function isValidRankedEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as {
    score?: unknown;
    request?: { id?: unknown; student?: unknown };
    breakdown?: unknown;
  };
  if (
    typeof candidate.score !== 'number' ||
    !Number.isFinite(candidate.score) ||
    candidate.score < 0 ||
    candidate.score > 100
  ) {
    return false;
  }
  if (!candidate.request || typeof candidate.request.id !== 'string' || typeof candidate.request.student !== 'string') {
    return false;
  }
  if (!Array.isArray(candidate.breakdown) || candidate.breakdown.length > 10) return false;
  return candidate.breakdown.every(
    (factor) =>
      Boolean(factor) &&
      typeof factor === 'object' &&
      typeof factor.factor === 'string' &&
      typeof factor.reason === 'string' &&
      typeof factor.points === 'number' &&
      Number.isFinite(factor.points) &&
      typeof factor.maxPoints === 'number' &&
      Number.isFinite(factor.maxPoints)
  );
}

function isValidAssignmentEntry(a: unknown): boolean {
  if (!a || typeof a !== 'object') return false;
  const item = a as Record<string, unknown>;
  return (
    typeof item.student === 'string' &&
    typeof item.itemName === 'string' &&
    typeof item.date === 'string' &&
    isValidIsoDate(item.date) &&
    typeof item.start === 'string' &&
    typeof item.end === 'string' &&
    typeof item.score === 'number' &&
    Number.isFinite(item.score)
  );
}

function isValidAlternativeEntry(alt: unknown): boolean {
  if (!alt || typeof alt !== 'object') return false;
  const item = alt as Record<string, unknown>;
  return (
    typeof item.student === 'string' &&
    typeof item.suggestedItemName === 'string' &&
    typeof item.location === 'string'
  );
}

/**
 * Type-guards incoming `/api/explain-allocation` request bodies against `AllocationResult`.
 *
 * @param body - Unknown parsed JSON payload from client.
 * @returns True if payload conforms to bounded allocation structure.
 */
export function isValidAllocationPayload(body: unknown): body is AllocationResult {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Partial<AllocationResult>;
  if (
    !Array.isArray(candidate.assignments) ||
    !Array.isArray(candidate.ranked) ||
    !Array.isArray(candidate.alternatives) ||
    !Array.isArray(candidate.reasons) ||
    !candidate.feasible ||
    typeof candidate.feasible !== 'object'
  ) {
    return false;
  }
  if (
    candidate.assignments.length > LIMITS.AI_MAX_LIST_ENTRIES ||
    candidate.ranked.length === 0 ||
    candidate.ranked.length > LIMITS.AI_MAX_LIST_ENTRIES ||
    candidate.alternatives.length > LIMITS.AI_MAX_LIST_ENTRIES ||
    candidate.reasons.length > LIMITS.AI_MAX_LIST_ENTRIES ||
    !candidate.reasons.every((reason) => typeof reason === 'string')
  ) {
    return false;
  }
  return (
    candidate.ranked.every(isValidRankedEntry) &&
    candidate.assignments.every(isValidAssignmentEntry) &&
    candidate.alternatives.every(isValidAlternativeEntry)
  );
}
