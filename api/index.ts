import { createApiApp, attachErrorMiddleware } from '../server/app.ts';

const app = createApiApp({ isProduction: true });
attachErrorMiddleware(app);

export default app;
