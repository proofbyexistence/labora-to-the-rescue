/**
 * Express server entry point providing security headers, compression, /api routing, and SPA serving.
 */
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import aiRoutes from './server/ai-routes.ts';
import { compressionMiddleware } from './server/compression-middleware.ts';
import {
  createSecurityHeadersMiddleware,
  sameOriginApiMiddleware,
} from './server/security-middleware.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function mountClientServing(app: express.Express): Promise<void> {
  if (!isProduction) {
    // Mount Vite dev middlewares cleanly inside Express in development.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    return;
  }

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

  app.get('*', (_req, res) => {
    const indexFile = path.join(distDir, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.sendFile(indexFile);
      return;
    }
    res.status(404).send('Production bundle not built.');
  });
}

async function startServer(): Promise<void> {
  const app = express();

  // Remove Express server fingerprint header on all responses and enable strong ETags.
  app.disable('x-powered-by');
  app.set('etag', 'strong');
  app.use(createSecurityHeadersMiddleware(isProduction));
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

  await mountClientServing(app);

  // Generic final error handler — never leaks stack traces or internal details.
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Unexpected server error.' });
  });

  app.listen(PORT, '0.0.0.0');
}

startServer();
