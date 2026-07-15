import { Channel, NotificationStatus, RateLimitScope, RateLimitStrategy } from '@prisma/client';

// ─── Request/Response Types ──────────────────────────────────

export interface NotifyRequest {
  channel: Channel;
  recipient: string;
  templateName?: string;
  subject?: string;
  body?: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
}

export interface NotifyResponse {
  id: string;
  status: 'queued';
}

export interface RateLimitRejection {
  error: 'rate_limit_exceeded';
  scope: RateLimitScope;
  limit: number;
  windowSecs: number;
  retryAfterSecs: number;
}

export interface NotificationJobPayload {
  notificationId: string;
  tenantId: string;
  channel: Channel;
  recipient: string;
  renderedSubject: string | null;
  renderedBody: string;
  idempotencyKey?: string;
}

// ─── Rate Limiter Types ──────────────────────────────────────

export interface RateLimitCheckParams {
  tenantId: string;
  scope: RateLimitScope;
  identifier: string;
  channel: Channel;
}

export interface RateLimitResult {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  windowSecs?: number;
  retryAfterSecs?: number;
}

// ─── Auth Types ──────────────────────────────────────────────

export interface AuthenticatedRequest {
  tenantId: string;
  apiKeyId?: string;
  clerkUserId?: string;
}

// ─── Delivery Provider ──────────────────────────────────────

export interface DeliveryResult {
  success: boolean;
  providerMsgId?: string;
  error?: string;
}
