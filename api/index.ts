import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp, attachErrorMiddleware } from '../server/app.ts';

let cachedApp: ReturnType<typeof createApiApp> | null = null;

function getApp() {
  if (!cachedApp) {
    const app = createApiApp({ isProduction: true });
    attachErrorMiddleware(app);
    cachedApp = app;
  }
  return cachedApp;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = getApp();
    return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Serverless initialization failed.';
    console.error('[Vercel API] Handler bootstrap error:', message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'API server initialization failed.' }));
    }
  }
}
