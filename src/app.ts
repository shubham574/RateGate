import express from 'express';
import cors from 'cors';
import { apiKeyAuth } from './middleware/apiKeyAuth';
import { errorHandler } from './middleware/errorHandler';
import notifyRoutes from './routes/notify.routes';
import rateLimitRulesRoutes from './routes/rateLimitRules.routes';
import usageRoutes from './routes/usage.routes';
import tenantRoutes from './routes/tenant.routes';

const app = express();

// ─── Global Middleware ───────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health Check ────────────────────────────────────────────
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

// ─── Authenticated Routes (Dashboard / Clerk) ─────────────────
const dashboardRouter = express.Router();
dashboardRouter.use('/v1/auth', authRoutes); // /sync endpoint
dashboardRouter.use(clerkAuth);
dashboardRouter.use('/v1/notify', notifyRoutes);
dashboardRouter.use('/v1/rate-limit-rules', rateLimitRulesRoutes);
dashboardRouter.use('/v1/usage', usageRoutes);
dashboardRouter.use('/v1/api-keys', apiKeyRoutes);
dashboardRouter.use('/v1/tenant', tenantRoutes);

app.use('/dashboard', dashboardRouter);

// ─── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

export default app;
