/**
 * Client-side validation and fetch wrappers for server-proxied Gemini AI routes.
 */
import { LIMITS } from './constants';
import type { AllocationResult } from './scheduler';
import { hasControlChars, normalizeText } from './validation';

export interface EquipmentSuggestion {
  itemId: string;
  reason: string;
}

export type AiSource = 'ai' | 'fallback';

export interface SuggestEquipmentResponse {
  suggestions: EquipmentSuggestion[];
  source: AiSource;
}

export interface ExplainAllocationResponse {
  text: string;
  source: AiSource;
}

/**
 * Validates and normalizes a student project description before sending it to the suggestion API.
 *
 * @param raw - Raw project description entered by the user.
 * @returns Validation status, normalized text, and optional error message.
 */
export function validateProjectDescription(raw: string): {
  ok: boolean;
  cleaned: string;
  error?: string;
} {
  if (typeof raw !== 'string' || hasControlChars(raw, true)) {
    return {
      ok: false,
      cleaned: '',
      error: 'Project description cannot contain control characters.',
    };
  }
  const cleaned = normalizeText(raw);
  if (cleaned.length < LIMITS.AI_PROJECT_MIN || cleaned.length > LIMITS.AI_PROJECT_MAX) {
    return {
      ok: false,
      cleaned,
      error: `Describe your project in ${LIMITS.AI_PROJECT_MIN} to ${LIMITS.AI_PROJECT_MAX} characters.`,
    };
  }
  return { ok: true, cleaned };
}

/**
 * Maps an AI response source tag to its user-facing badge label.
 *
 * @param source - Origin returned by the backend (`'ai'` or `'fallback'`).
 * @returns Display badge text.
 */
export function formatAiSourceLabel(source: AiSource): string {
  return source === 'ai' ? 'Suggested by AI' : 'Smart keyword match';
}

/**
 * Requests equipment recommendations for a project description from `/api/suggest-equipment`.
 *
 * @param projectText - Student project summary (10–500 characters).
 * @returns Validated equipment suggestions and response source badge.
 * @throws Error if validation fails or the server returns an error status.
 */
export async function suggestEquipment(
  projectText: string
): Promise<SuggestEquipmentResponse> {
  const validation = validateProjectDescription(projectText);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const response = await fetch('/api/suggest-equipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: validation.cleaned }),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Could not reach equipment suggestion service.');
  }

  if (!response.ok) {
    const serverError = (data as { error?: unknown } | null)?.error;
    throw new Error(
      typeof serverError === 'string' && serverError
        ? serverError
        : 'Unable to fetch equipment suggestions.'
    );
  }

  const payload = data as Partial<SuggestEquipmentResponse>;
  if (!Array.isArray(payload.suggestions)) {
    throw new Error('Received an unexpected response format.');
  }

  return {
    suggestions: payload.suggestions,
    source: payload.source === 'ai' ? 'ai' : 'fallback',
  };
}

/**
 * Requests a plain-language summary of a deterministic allocation decision from `/api/explain-allocation`.
 *
 * @param allocation - Deterministic conflict allocation output.
 * @returns Plain-language explanation text and source badge.
 * @throws Error if the service cannot be reached or returns an invalid payload.
 */
export async function explainAllocationWithAI(
  allocation: AllocationResult
): Promise<ExplainAllocationResponse> {
  const response = await fetch('/api/explain-allocation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(allocation),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Could not reach allocation explanation service.');
  }

  if (!response.ok) {
    const serverError = (data as { error?: unknown } | null)?.error;
    throw new Error(
      typeof serverError === 'string' && serverError
        ? serverError
        : 'Unable to explain allocation right now.'
    );
  }

  const payload = data as Partial<ExplainAllocationResponse>;
  if (typeof payload.text !== 'string' || !payload.text.trim()) {
    throw new Error('Received an empty explanation response.');
  }

  return {
    text: payload.text.trim(),
    source: payload.source === 'ai' ? 'ai' : 'fallback',
  };
}
