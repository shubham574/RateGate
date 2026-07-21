import crypto from 'crypto';
import { WebhookEvent } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────

export interface WebhookNotificationData {
  notificationId: string;
  channel: string;
  recipient: string;
  status: string;
  providerMsgId?: string | null;
  errorMessage?: string | null;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: WebhookNotificationData;
}

// ─── Event name mapping ──────────────────────────────────────

const EVENT_NAMES: Record<WebhookEvent, string> = {
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_DELIVERED: 'notification.delivered',
  NOTIFICATION_FAILED: 'notification.failed',
  NOTIFICATION_RATE_LIMITED: 'notification.rate_limited',
};

// ─── Payload Builder ─────────────────────────────────────────

/**
 * Builds the standardised webhook payload for a notification event.
 */
export function buildPayload(
  event: WebhookEvent,
  notification: WebhookNotificationData
): WebhookPayload {
  return {
    event: EVENT_NAMES[event],
    timestamp: new Date().toISOString(),
    data: {
      notificationId: notification.notificationId,
      channel: notification.channel,
      recipient: notification.recipient,
      status: notification.status,
      providerMsgId: notification.providerMsgId ?? null,
      errorMessage: notification.errorMessage ?? null,
    },
  };
}

// ─── HMAC Signing ────────────────────────────────────────────

/**
 * Signs a raw JSON body string with the tenant's webhookSecret using HMAC-SHA256.
 * Returns the header value in the format: `sha256=<hex digest>`
 *
 * Tenants should verify the signature by:
 *   1. Reading the raw request body as a UTF-8 string (do NOT parse JSON first).
 *   2. Computing: HMAC-SHA256(webhookSecret, rawBody) → hex string
 *   3. Prepending "sha256="
 *   4. Comparing with X-RateGate-Signature using crypto.timingSafeEqual —
 *      NEVER a plain string comparison (=== / ==), which is vulnerable to
 *      timing attacks that leak how many characters matched.
 *
 * Example (tenant verification):
 *   const expected = Buffer.from(`sha256=${computedHex}`);
 *   const received = Buffer.from(req.headers['x-rategate-signature']);
 *   if (expected.length !== received.length) throw new Error('Invalid signature');
 *   if (!crypto.timingSafeEqual(expected, received)) throw new Error('Invalid signature');
 */
export function signPayload(secret: string, rawBody: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}
