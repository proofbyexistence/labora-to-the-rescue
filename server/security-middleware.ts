/**
 * Security headers (CSP, frame-ancestors, nosniff) and same-origin API guard middlewares.
 */
import type { NextFunction, Request, Response } from 'express';

/**
 * Builds the set of trusted origins derived from the request Host header and `APP_URL`.
 *
 * @param req - Incoming Express request.
 * @returns Set of allowed HTTP/HTTPS origins.
 */
export function getAllowedOrigins(req: Request): Set<string> {
  const allowed = new Set<string>();
  const host = req.headers.host;
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  const appUrl = (process.env.APP_URL ?? '').trim();
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      // Ignore malformed APP_URL env values safely without crashing middleware.
    }
  }
  return allowed;
}

/**
 * Generates the Content-Security-Policy header string for development or production mode.
 *
 * @param isProduction - Whether the server runs in production mode.
 * @returns Serialized CSP directive header value.
 */
export function buildSecurityCsp(isProduction: boolean): string {
  const styleSrc = isProduction
    ? "style-src 'self' https://fonts.googleapis.com"
    : // Development exception: Vite dev middleware dynamically injects component CSS into <style> tags.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com";

  const connectSrc = isProduction
    ? "connect-src 'self'"
    : // Development exception: Vite client opens WebSocket checks on port 24678 in dev mode.
      "connect-src 'self' ws: wss:";

  return [
    "default-src 'self'",
    "script-src 'self'",
    styleSrc,
    // Font exception: allow Google Fonts static CDN alongside same-origin font assets.
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Preview exception: AI Studio embeds the live preview inside nested *.google.com / *.usercontent.goog iframes.
    "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com https://*.usercontent.goog",
  ].join('; ');
}

/**
 * Creates middleware attaching CSP, nosniff, referrer, and permissions headers.
 *
 * @param isProduction - Whether the server runs in production mode.
 * @returns Express middleware handler.
 */
export function createSecurityHeadersMiddleware(isProduction: boolean) {
  const cspHeader = buildSecurityCsp(isProduction);
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Content-Security-Policy', cspHeader);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  };
}

/**
 * Enforces same-origin CORS rules on `/api` routes and handles preflight OPTIONS checks.
 *
 * @param req - Incoming Express request.
 * @param res - Outgoing Express response.
 * @param next - Next middleware callback.
 */
export function sameOriginApiMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.vary('Origin');
  const origin = req.headers.origin;
  if (origin) {
    const allowed = getAllowedOrigins(req);
    if (!allowed.has(origin)) {
      res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
