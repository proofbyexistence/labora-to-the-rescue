import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import aiRoutes from './server/aiRoutes.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function getAllowedOrigins(req: Request): Set<string> {
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
      // Ignore malformed APP_URL env strings cleanly.
    }
  }
  return allowed;
}

function buildSecurityCsp(): string {
  const styleSrc = isProduction
    ? "style-src 'self' https://fonts.googleapis.com"
    : // Development exception: Vite dev middleware dynamically injects component CSS into <style> tags.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com";

  return [
    "default-src 'self'",
    "script-src 'self'",
    styleSrc,
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Preview exception: AI Studio renders the live app inside an embedded Google preview iframe.
    "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com",
  ].join('; ');
}

function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('Content-Security-Policy', buildSecurityCsp());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function sameOriginApiMiddleware(
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

const COMPRESSIBLE_CONTENT_TYPE =
  /^(text\/|application\/(javascript|json|xml|xhtml\+xml)|image\/svg\+xml)/i;

function compressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'HEAD') {
    next();
    return;
  }

  const acceptEncoding = String(req.headers['accept-encoding'] ?? '');
  const encoding: 'br' | 'gzip' | null = /\bbr\b/i.test(acceptEncoding)
    ? 'br'
    : /\bgzip\b/i.test(acceptEncoding)
      ? 'gzip'
      : null;

  res.vary('Accept-Encoding');
  if (!encoding) {
    next();
    return;
  }

  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  let decided = false;
  let compressor: zlib.BrotliCompress | zlib.Gzip | null = null;

  const initCompressorIfEligible = (firstChunkSize: number): void => {
    if (decided) return;
    decided = true;

    const status = res.statusCode;
    const existingEnc = res.getHeader('Content-Encoding');
    const contentType = String(res.getHeader('Content-Type') ?? '');
    const rawLen = res.getHeader('Content-Length');
    const knownLen = typeof rawLen === 'number' ? rawLen : Number(rawLen);

    if (
      status === 204 ||
      status === 304 ||
      existingEnc ||
      !COMPRESSIBLE_CONTENT_TYPE.test(contentType) ||
      (Number.isFinite(knownLen) && knownLen > 0 && knownLen < 1024) ||
      (!Number.isFinite(knownLen) && firstChunkSize > 0 && firstChunkSize < 1024 && res.writableEnded)
    ) {
      return;
    }

    res.removeHeader('Content-Length');
    res.setHeader('Content-Encoding', encoding);

    compressor =
      encoding === 'br'
        ? zlib.createBrotliCompress({
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
          })
        : zlib.createGzip({ level: 6 });

    compressor.on('data', (chunk: Buffer) => {
      origWrite(chunk);
    });
    compressor.on('end', () => {
      origEnd();
    });
    compressor.on('error', () => {
      res.destroy();
    });
  };

  res.write = ((
    chunk: unknown,
    encodingOrCb?: BufferEncoding | ((error?: Error | null) => void),
    cb?: (error?: Error | null) => void
  ): boolean => {
    const buf =
      typeof chunk === 'string'
        ? Buffer.from(chunk, typeof encodingOrCb === 'string' ? encodingOrCb : 'utf8')
        : Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.alloc(0);

    initCompressorIfEligible(buf.length);
    if (compressor) {
      return compressor.write(buf);
    }
    return origWrite(chunk as never, encodingOrCb as never, cb as never);
  }) as typeof res.write;

  res.end = ((
    chunk?: unknown,
    encodingOrCb?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response => {
    const hasChunk = chunk !== undefined && chunk !== null && typeof chunk !== 'function';
    const buf = hasChunk
      ? typeof chunk === 'string'
        ? Buffer.from(chunk, typeof encodingOrCb === 'string' ? encodingOrCb : 'utf8')
        : Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.alloc(0)
      : Buffer.alloc(0);

    if (!decided) {
      const contentType = String(res.getHeader('Content-Type') ?? '');
      const rawLen = res.getHeader('Content-Length');
      const knownLen = typeof rawLen === 'number' ? rawLen : Number(rawLen);
      const effectiveLen = Number.isFinite(knownLen) && knownLen > 0 ? knownLen : buf.length;
      if (
        res.statusCode !== 204 &&
        res.statusCode !== 304 &&
        !res.getHeader('Content-Encoding') &&
        COMPRESSIBLE_CONTENT_TYPE.test(contentType) &&
        effectiveLen >= 1024
      ) {
        initCompressorIfEligible(effectiveLen);
      } else {
        decided = true;
      }
    }

    if (compressor) {
      if (hasChunk && buf.length > 0) {
        compressor.end(buf);
      } else {
        compressor.end();
      }
      return res;
    }

    return origEnd(chunk as never, encodingOrCb as never, cb as never);
  }) as typeof res.end;

  next();
}

async function startServer() {
  const app = express();

  // Remove Express server fingerprint header on all responses and enable strong ETags.
  app.disable('x-powered-by');
  app.set('etag', 'strong');
  app.use(securityHeadersMiddleware);
  app.use(compressionMiddleware);

  app.use(
    '/api',
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    sameOriginApiMiddleware,
    aiRoutes
  );

  if (!isProduction) {
    // Mount Vite dev middlewares cleanly inside Express in development.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          const relPath = path.relative(distDir, filePath).replace(/\\/g, '/');
          if (relPath === 'index.html' || relPath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          } else if (relPath.startsWith('assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
          }
        },
      })
    );
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        res.sendFile(indexFile);
        return;
      }
      res.status(404).send('Production bundle not built.');
    });
  }

  // Generic final error handler — never leaks stack traces or internal details.
  app.use(
    (
      _err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      res.status(500).json({ error: 'Unexpected server error.' });
    }
  );

  app.listen(PORT, '0.0.0.0');
}

startServer();
