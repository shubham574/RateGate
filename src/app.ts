import express from 'express';
import cors from 'cors';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { errorHandler } from './middleware/errorHandler';
import notifyRoutes from './routes/notify.routes';
import rateLimitRulesRoutes from './routes/rateLimitRules.routes';
import usageRoutes from './routes/usage.routes';
import tenantRoutes from './routes/tenant.routes';
import templatesRoutes from './routes/templates.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

// ─── Global Middleware ───────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health & Root Routes ────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ 
    name: 'RateGate API', 
    status: 'online', 
    version: '1.0.0',
    message: 'Welcome to the RateGate API. Please use the /dashboard/v1 or /v1 endpoints.'
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { clerkAuth } from './middleware/clerkAuth';
import apiKeyRoutes from './routes/apiKeys.routes';
import authRoutes from './routes/auth.routes';

// ─── Authenticated Routes (API Key) ──────────────────────────
app.use('/v1/notify', apiKeyAuth, notifyRoutes);
app.use('/v1/rate-limit-rules', apiKeyAuth, rateLimitRulesRoutes);
app.use('/v1/usage', apiKeyAuth, usageRoutes);
app.use('/v1/tenant', apiKeyAuth, tenantRoutes);
app.use('/v1/api-keys', apiKeyAuth, apiKeyRoutes);
app.use('/v1/templates', apiKeyAuth, templatesRoutes);
// /v1/webhooks/deliveries is accessible via API key; /v1/webhooks/test is Clerk-only (registered below)
app.use('/v1/webhooks', apiKeyAuth, webhookRoutes);

// ─── Authenticated Routes (Dashboard / Clerk) ─────────────────
const dashboardRouter = express.Router();
dashboardRouter.use('/v1/auth', authRoutes); // /sync endpoint
dashboardRouter.use(clerkAuth);
  dashboardRouter.use('/v1/notify', notifyRoutes);
  dashboardRouter.use('/v1/rate-limit-rules', rateLimitRulesRoutes);
  dashboardRouter.use('/v1/usage', usageRoutes);
  dashboardRouter.use('/v1/api-keys', apiKeyRoutes);
  dashboardRouter.use('/v1/tenant', tenantRoutes);
  dashboardRouter.use('/v1/templates', templatesRoutes);
  // All webhook routes (including POST /test) are available via Clerk auth
  dashboardRouter.use('/v1/webhooks', webhookRoutes);

app.use('/dashboard', dashboardRouter);

// ─── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

export default app;
