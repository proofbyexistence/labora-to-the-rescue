/**
 * Sliding-window per-IP rate limiter protecting /api endpoints against burst traffic.
 */
import type { NextFunction, Request, Response } from 'express';
import { LIMITS } from '../src/js/constants.ts';

const requestLogByIp = new Map<string, number[]>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Evaluates and records whether a client IP is within the sliding-window rate limit.
 *
 * @param ip - Client IP address string.
 * @param now - Optional epoch timestamp in milliseconds for deterministic tests.
 * @returns Allowance verdict and `retryAfterSeconds` hint when throttled.
 */
export function checkRateLimit(
  ip: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const cutoff = now - LIMITS.RATE_LIMIT_WINDOW_MS;
  const recent = (requestLogByIp.get(ip) ?? []).filter((ts) => ts > cutoff);

  if (recent.length >= LIMITS.RATE_LIMIT_MAX_REQUESTS) {
    requestLogByIp.set(ip, recent);
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + LIMITS.RATE_LIMIT_WINDOW_MS - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  requestLogByIp.set(ip, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Express middleware returning HTTP 429 with `Retry-After` when per-IP burst limits are exceeded.
 *
 * @param req - Incoming Express request.
 * @param res - Outgoing Express response.
 * @param next - Next middleware callback.
 */
export function aiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const verdict = checkRateLimit(ip);
  if (!verdict.allowed) {
    res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
    res.status(429).json({
      error: 'Too many requests. Please wait a minute before trying again.',
    });
    return;
  }
  next();
}
