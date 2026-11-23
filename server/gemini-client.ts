/**
 * Lazy server-side @google/genai client wrapper with request timeout and markup stripping.
 */
import { GoogleGenAI } from '@google/genai';

/** Default Gemini model alias used for equipment matching and summary generation. */
export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

/** Maximum server-side wait duration before falling back to deterministic responses. */
export const GEMINI_TIMEOUT_MS = 10_000;

let cachedClient: GoogleGenAI | null = null;

/**
 * Returns a lazily initialized server-side Gemini client when `GEMINI_API_KEY` is configured.
 *
 * @returns Initialized `GoogleGenAI` client, or null when no API key is configured.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return cachedClient;
}

/**
 * Rejects a promise if it exceeds the configured server-side AI timeout.
 *
 * @param promise - Upstream async operation to bound.
 * @param timeoutMs - Maximum timeout in milliseconds.
 * @returns Resolved value of `promise`, or rejects on timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = GEMINI_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI request timed out')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Strips HTML/XML tags and control characters from untrusted or model-generated text.
 *
 * @param raw - Raw string from user input or Gemini output.
 * @param maxLength - Maximum retained string length.
 * @returns Sanitized plain-text string.
 */
export function stripMarkup(raw: string, maxLength = 500): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
