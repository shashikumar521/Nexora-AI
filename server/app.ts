import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api.ts';

dotenv.config();

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function getConfiguredOrigins(): Set<string> {
  const origins = new Set<string>();

  const raw = process.env.FRONTEND_ORIGIN || '';
  for (const part of raw.split(',')) {
    const normalized = normalizeOrigin(part);
    if (normalized) origins.add(normalized);
  }

  for (const vercelHost of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (vercelHost?.trim()) {
      origins.add(`https://${vercelHost.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')}`);
    }
  }

  return origins;
}

export interface CreateApiAppOptions {
  isProduction?: boolean;
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const app = express();
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';
  const configuredOrigins = getConfiguredOrigins();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers (preserve iframe compatibility for preview environments)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Origin-restricted CORS middleware (supports same-host, Vercel deployment URLs, and FRONTEND_ORIGIN)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestHost = req.headers.host;
    const sameHostOrigins = new Set<string>();
    if (requestHost) {
      sameHostOrigins.add(`https://${requestHost}`);
      sameHostOrigins.add(`http://${requestHost}`);
    }

    const corsMiddleware = cors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        const normalized = normalizeOrigin(origin);

        if (sameHostOrigins.has(normalized)) {
          return callback(null, true);
        }

        if (configuredOrigins.has(normalized)) {
          return callback(null, true);
        }

        if (
          !isProduction &&
          (normalized === 'http://localhost:3000' ||
            normalized === 'http://127.0.0.1:3000' ||
            normalized === 'http://localhost:5173' ||
            normalized.endsWith('.run.app'))
        ) {
          return callback(null, true);
        }

        console.warn(`[CORS] Blocked cross-origin request from origin: ${normalized}`);
        return callback(new Error('CORS origin not allowed'));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    corsMiddleware(req, res, (err) => {
      if (err) {
        return res.status(403).json({
          error:
            'Cross-origin request blocked by CORS policy. Configure FRONTEND_ORIGIN if frontend is hosted separately.',
        });
      }
      next();
    });
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Mount API routes
  app.use('/api', apiRouter);

  // Ensure unknown /api/* routes always return JSON 404 rather than HTML fallback
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return app;
}

export function attachErrorMiddleware(app: Express): void {
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server] Unhandled error:', err?.message || err);
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON request payload.' });
    }
    res.status(err?.status || 500).json({ error: 'Internal server error.' });
  });
}
