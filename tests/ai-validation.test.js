import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  createAiRouter,
  isValidAllocationPayload,
  validateAndSanitizeSuggestions,
} from '../server/aiRoutes.ts';
import {
  loadServerCatalog,
  suggestEquipmentFallback,
} from '../server/catalogFallback.ts';
import { stripMarkup, withTimeout } from '../server/geminiClient.ts';
import { checkRateLimit } from '../server/rateLimit.ts';
import {
  formatAiSourceLabel,
  validateProjectDescription,
} from '../src/js/ai-client.ts';
import { allocate } from '../src/js/scheduler.ts';
import { buildItem, buildRequest, FIXED_TODAY, FIXED_TUESDAY } from './helpers.js';

async function startTestApp(router) {
  const app = express();
  app.use('/api', router);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe('project description length limits and client validation', () => {
  it('rejects project descriptions shorter than 10 chars, longer than 500 chars, or containing control chars', () => {
    assert.equal(validateProjectDescription('   too short ').ok, false);
    assert.equal(validateProjectDescription('a'.repeat(501)).ok, false);
    assert.equal(validateProjectDescription('Measure\u0007oscilloscope signal').ok, false);

    const exactMin = validateProjectDescription('  1234567890  ');
    assert.equal(exactMin.ok, true);
    assert.equal(exactMin.cleaned, '1234567890');

    const exactMax = validateProjectDescription('a'.repeat(500));
    assert.equal(exactMax.ok, true);
    assert.equal(formatAiSourceLabel('ai'), 'Suggested by AI');
    assert.equal(formatAiSourceLabel('fallback'), 'Smart keyword match');
  });
});

describe('model-output sanitizer and markup stripping', () => {
  it('strips HTML/XML tags and control characters and caps string length', () => {
    const cleaned = stripMarkup('<script>alert(1)</script><b>Benchtop</b>\u0007 Meter', 25);
    assert.equal(cleaned.includes('<'), false);
    assert.equal(cleaned.includes('>'), false);
    assert.equal(cleaned.includes('\u0007'), false);
    assert.ok(cleaned.length <= 25);
  });

  it('drops unknown itemIds, removes duplicates, strips markup, truncates reasons, and caps at 5 items', () => {
    const catalog = loadServerCatalog();
    const validIds = [...catalog.validItemIds];
    const payload = JSON.stringify({
      suggestions: [
        { itemId: 'eq-unknown-999', reason: 'Should be dropped because ID is not in catalog' },
        { itemId: validIds[0], reason: `<b>Fits</b> ${'x'.repeat(160)}` },
        { itemId: validIds[0], reason: 'Duplicate ID should be dropped' },
        { itemId: validIds[1], reason: 'ok' }, // < 3 chars dropped
        { itemId: validIds[2], reason: '<script>xss</script> High bandwidth measurement' },
        { itemId: validIds[3], reason: 'Valid item 3' },
        { itemId: validIds[4], reason: 'Valid item 4' },
        { itemId: validIds[5], reason: 'Valid item 5' },
        { itemId: validIds[6], reason: 'Valid item 6 beyond max 5 cap' },
      ],
    });

    const sanitized = validateAndSanitizeSuggestions(payload, catalog.validItemIds);
    assert.equal(sanitized.length, 5);
    assert.deepEqual(
      sanitized.map((s) => s.itemId),
      [validIds[0], validIds[2], validIds[3], validIds[4], validIds[5]]
    );
    assert.ok(sanitized[0].reason.length <= 119);
    assert.equal(sanitized[1].reason.includes('<script>'), false);
  });

  it('throws on invalid JSON or missing suggestions array', () => {
    const catalog = loadServerCatalog();
    assert.throws(() => validateAndSanitizeSuggestions('{not json', catalog.validItemIds));
    assert.throws(() => validateAndSanitizeSuggestions('{"items":[]}', catalog.validItemIds));
  });
});

describe('AI endpoint validation, stubbed Gemini output, and fallback behavior', () => {
  it('returns sanitized AI suggestions when stubbed Gemini succeeds', async () => {
    const catalog = loadServerCatalog();
    const firstId = [...catalog.validItemIds][0];
    const stubClient = {
      models: {
        async generateContent() {
          return {
            text: JSON.stringify({
              suggestions: [
                { itemId: 'eq-invented', reason: 'Hallucinated instrument' },
                { itemId: firstId, reason: '<i>Ideal</i> for optical spectrum sweep.' },
              ],
            }),
          };
        },
      },
    };

    const server = await startTestApp(createAiRouter({ getGeminiClient: () => stubClient }));
    try {
      const res = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.10' },
        body: JSON.stringify({ project: 'Measure optical transmission spectra on thin glass films.' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.source, 'ai');
      assert.equal(body.suggestions.length, 1);
      assert.equal(body.suggestions[0].itemId, firstId);
      assert.equal(body.suggestions[0].reason, 'Ideal for optical spectrum sweep.');
    } finally {
      await server.close();
    }
  });

  it('falls back to deterministic keyword suggestions when stubbed Gemini fails or returns invalid JSON', async () => {
    const failingClient = {
      models: {
        async generateContent() {
          throw new Error('Upstream AI error');
        },
      },
    };
    const invalidJsonClient = {
      models: {
        async generateContent() {
          return { text: 'not-valid-json' };
        },
      },
    };

    const failServer = await startTestApp(createAiRouter({ getGeminiClient: () => failingClient }));
    const badJsonServer = await startTestApp(createAiRouter({ getGeminiClient: () => invalidJsonClient }));
    try {
      const r1 = await fetch(`${failServer.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.11' },
        body: JSON.stringify({ project: 'Need oscilloscope and signal generator for circuit filter test.' }),
      });
      assert.equal(r1.status, 200);
      const b1 = await r1.json();
      assert.equal(b1.source, 'fallback');
      assert.ok(b1.suggestions.length >= 1 && b1.suggestions.length <= 5);

      const r2 = await fetch(`${badJsonServer.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.12' },
        body: JSON.stringify({ project: 'Need oscilloscope and signal generator for circuit filter test.' }),
      });
      assert.equal(r2.status, 200);
      const b2 = await r2.json();
      assert.equal(b2.source, 'fallback');
      assert.ok(b2.suggestions.length >= 1);
    } finally {
      await failServer.close();
      await badJsonServer.close();
    }
  });

  it('falls back cleanly when stubbed Gemini exceeds the timeout', async () => {
    const slowClient = {
      models: {
        generateContent() {
          return new Promise(() => {});
        },
      },
    };

    await assert.rejects(withTimeout(new Promise(() => {}), 10), /timed out/i);

    const server = await startTestApp(createAiRouter({ getGeminiClient: () => slowClient, timeoutMs: 20 }));
    try {
      const res = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.13' },
        body: JSON.stringify({ project: 'Microfluidic PDMS device inspection and laser alignment' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.source, 'fallback');
      assert.ok(body.suggestions.length >= 1);
    } finally {
      await server.close();
    }
  });

  it('rejects too-short, too-long, control-char, malformed JSON, and oversized payloads on suggest-equipment', async () => {
    const server = await startTestApp(createAiRouter({ getGeminiClient: () => null }));
    try {
      const shortRes = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.14' },
        body: JSON.stringify({ project: 'short' }),
      });
      assert.equal(shortRes.status, 400);

      const longRes = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.15' },
        body: JSON.stringify({ project: 'x'.repeat(501) }),
      });
      assert.equal(longRes.status, 400);

      const hugeRes = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.16' },
        body: JSON.stringify({ project: 'x'.repeat(6000) }),
      });
      assert.equal(hugeRes.status, 413);

      const badJsonRes = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.17' },
        body: '{invalid',
      });
      assert.equal(badJsonRes.status, 400);
    } finally {
      await server.close();
    }
  });

  it('validates explain-allocation payloads and returns fallback summary when AI is unavailable', async () => {
    assert.equal(isValidAllocationPayload({ ranked: [] }), false);

    const item = buildItem();
    const allocation = allocate(
      [
        buildRequest({ id: 'r1', student: 'Maya Lin', deadline: '2026-11-25', preferredDate: FIXED_TUESDAY }),
        buildRequest({ id: 'r2', student: 'Alex Rivera', deadline: '2026-11-28', preferredDate: FIXED_TUESDAY }),
      ],
      item,
      [],
      [item],
      { referenceDate: FIXED_TODAY }
    );
    assert.equal(isValidAllocationPayload(allocation), true);

    const server = await startTestApp(createAiRouter({ getGeminiClient: () => null }));
    try {
      const badRes = await fetch(`${server.baseUrl}/api/explain-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.18' },
        body: JSON.stringify({ ranked: [] }),
      });
      assert.equal(badRes.status, 400);

      const okRes = await fetch(`${server.baseUrl}/api/explain-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.19' },
        body: JSON.stringify(allocation),
      });
      assert.equal(okRes.status, 200);
      const body = await okRes.json();
      assert.equal(body.source, 'fallback');
      assert.ok(body.text.includes('Maya Lin'));
    } finally {
      await server.close();
    }
  });

  it('returns open available items from suggestEquipmentFallback when no keywords match', () => {
    const catalog = loadServerCatalog();
    const fallback = suggestEquipmentFallback('zyxwvutsrqponm unknown topic');
    assert.ok(fallback.length >= 1 && fallback.length <= 3);
    for (const s of fallback) {
      assert.ok(catalog.validItemIds.has(s.itemId));
    }
  });
});

describe('rate limiter sliding window', () => {
  it('allows 10 requests within 60 seconds, blocks the 11th with retryAfterSeconds, and resets after 60 seconds', () => {
    const ip = '198.51.100.77';
    const start = 1_700_000_000_000;

    for (let i = 0; i < 10; i += 1) {
      const verdict = checkRateLimit(ip, start + i * 1000);
      assert.equal(verdict.allowed, true);
      assert.equal(verdict.retryAfterSeconds, 0);
    }

    const eleventh = checkRateLimit(ip, start + 10_000);
    assert.equal(eleventh.allowed, false);
    assert.ok(eleventh.retryAfterSeconds >= 49);

    const afterWindow = checkRateLimit(ip, start + 61_000);
    assert.equal(afterWindow.allowed, true);
  });

  it('returns HTTP 429 with Retry-After header when an IP exceeds 10 API calls per minute', async () => {
    const server = await startTestApp(createAiRouter({ getGeminiClient: () => null }));
    const burstIp = '192.0.2.250';
    try {
      for (let i = 0; i < 10; i += 1) {
        const res = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': burstIp },
          body: JSON.stringify({ project: 'Need oscilloscope and signal generator for circuit test.' }),
        });
        assert.equal(res.status, 200);
      }
      const blocked = await fetch(`${server.baseUrl}/api/suggest-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': burstIp },
        body: JSON.stringify({ project: 'Need oscilloscope and signal generator for circuit test.' }),
      });
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    } finally {
      await server.close();
    }
  });
});
