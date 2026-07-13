import express from 'express';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { errorHandler } from './middleware/errorHandler';
import notifyRoutes from './routes/notify.routes';
import rateLimitRulesRoutes from './routes/rateLimitRules.routes';
import usageRoutes from './routes/usage.routes';

const app = express();

// ─── Global Middleware ───────────────────────────────────────
app.use(express.json());

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Authenticated Routes ────────────────────────────────────
app.use('/v1/notify', apiKeyAuth, notifyRoutes);
app.use('/v1/rate-limit-rules', apiKeyAuth, rateLimitRulesRoutes);
app.use('/v1/usage', apiKeyAuth, usageRoutes);

// ─── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

export default app;
