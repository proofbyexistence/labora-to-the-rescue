/**
 * Express /api router for Gemini equipment suggestions and plain-language allocation summaries.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { LIMITS } from '../src/js/constants.ts';
import { explainAllocation } from '../src/js/scheduler.ts';
import { requestAiAllocationSummary, requestAiEquipmentSuggestions } from './ai-prompts.ts';
import {
  isValidAllocationPayload,
  validateAndSanitizeSuggestions,
  validateSuggestProjectInput,
} from './ai-validation.ts';
import { loadServerCatalog, suggestEquipmentFallback } from './catalog-fallback.ts';
import { GEMINI_TIMEOUT_MS, getGeminiClient, stripMarkup } from './gemini-client.ts';
import { aiRateLimiter } from './rate-limit.ts';

export { isValidAllocationPayload, validateAndSanitizeSuggestions };

export interface AiRouterDependencies {
  getGeminiClient?: typeof getGeminiClient;
  timeoutMs?: number;
}

function handleJsonError(
  err: Error & { status?: number; type?: string },
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    res.status(413).json({ error: 'Request payload exceeds the 5 KB limit.' });
    return;
  }
  if (err instanceof SyntaxError || err?.status === 400) {
    res.status(400).json({ error: 'Invalid JSON request body.' });
    return;
  }
  next(err);
}

async function handleSuggestEquipment(
  req: Request,
  res: Response,
  resolveGeminiClient: typeof getGeminiClient,
  timeoutMs: number
): Promise<void> {
  const projectCheck = validateSuggestProjectInput((req.body as { project?: unknown } | undefined)?.project);
  if (!projectCheck.ok) {
    res.status(400).json({ error: projectCheck.error });
    return;
  }

  try {
    const catalog = loadServerCatalog();
    const ai = resolveGeminiClient();
    if (ai) {
      try {
        const suggestions = await requestAiEquipmentSuggestions(
          ai, catalog.compact, catalog.validItemIds, projectCheck.value, timeoutMs
        );
        if (suggestions.length > 0) {
          res.json({ suggestions, source: 'ai' });
          return;
        }
      } catch {
        // Fall through cleanly to deterministic keyword fallback when AI fails or times out.
      }
    }
    res.json({ suggestions: suggestEquipmentFallback(projectCheck.value), source: 'fallback' });
  } catch {
    res.status(500).json({ error: 'Unable to suggest equipment right now. Please try keyword search instead.' });
  }
}

async function handleExplainAllocation(
  req: Request,
  res: Response,
  resolveGeminiClient: typeof getGeminiClient,
  timeoutMs: number
): Promise<void> {
  if (!isValidAllocationPayload(req.body)) {
    res.status(400).json({ error: 'Invalid allocation summary payload.' });
    return;
  }

  try {
    const allocation = req.body;
    const deterministicSummary = stripMarkup(explainAllocation(allocation), LIMITS.AI_SUMMARY_MAX);
    const ai = resolveGeminiClient();
    if (ai) {
      try {
        const text = await requestAiAllocationSummary(ai, allocation, timeoutMs);
        if (text.length >= 15) {
          res.json({ text, source: 'ai' });
          return;
        }
      } catch {
        // Fall back cleanly to deterministic explainAllocation text on any AI error/timeout.
      }
    }
    res.json({
      text:
        deterministicSummary ||
        'Fair-allocation priority scores have assigned the contested bench slot and earliest open alternatives.',
      source: 'fallback',
    });
  } catch {
    res.status(500).json({ error: 'Unable to explain allocation right now.' });
  }
}

/**
 * Builds the Express `/api` router with injectable Gemini dependencies for testing.
 *
 * @param deps - Optional client factory and timeout overrides.
 * @returns Configured Express router mounting `/suggest-equipment` and `/explain-allocation`.
 */
export function createAiRouter(deps: AiRouterDependencies = {}) {
  const resolveGeminiClient = deps.getGeminiClient ?? getGeminiClient;
  const timeoutMs = deps.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const router = express.Router();

  router.use(express.json({ limit: LIMITS.AI_BODY_LIMIT }));
  router.use(handleJsonError);

  router.post('/suggest-equipment', aiRateLimiter, (req: Request, res: Response) =>
    handleSuggestEquipment(req, res, resolveGeminiClient, timeoutMs)
  );
  router.post('/explain-allocation', aiRateLimiter, (req: Request, res: Response) =>
    handleExplainAllocation(req, res, resolveGeminiClient, timeoutMs)
  );

  return router;
}

export default createAiRouter();
