import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const requestLogByIp = new Map<string, number[]>();

/**
 * Extract client IP cleanly for in-memory per-IP rate limiting.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function checkRateLimit(
  ip: string,
  now = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const cutoff = now - WINDOW_MS;
  const recent = (requestLogByIp.get(ip) ?? []).filter((ts) => ts > cutoff);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLogByIp.set(ip, recent);
    const oldest = recent[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  requestLogByIp.set(ip, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function aiRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
