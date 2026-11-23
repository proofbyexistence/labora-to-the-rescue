import { GoogleGenAI } from '@google/genai';

// Default Gemini model recommended by AI Studio for fast structured/plain-text tasks.
export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const GEMINI_TIMEOUT_MS = 10_000;

let cachedClient: GoogleGenAI | null = null;

/**
 * Return a lazily initialized server-side Gemini client when GEMINI_API_KEY is configured.
 * Never exposes or logs the secret key.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY ?? '').trim();
  if (!apiKey) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

/**
 * Reject a promise if it exceeds the configured server-side AI timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = GEMINI_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('AI request timed out'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Strip any HTML/XML tags and control characters from untrusted or model-generated strings.
 */
export function stripMarkup(raw: string, maxLength = 500): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
