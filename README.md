# RateGate

RateGate is a **Multi-tenant Notification API** with Built-in Rate Limiting. It provides a robust backend to handle emails and SMS notifications gracefully, backed by a Next.js dashboard for tenant management. RateGate is designed to protect your API from abuse, enforce usage tiers, and deliver real-time webhook updates when notification statuses change.

---

## Features

- **Multi-tenant Architecture:** Easy isolation and management for multiple organizations/tenants.
- **Robust Rate Limiting:** Built-in safeguards against API abuse with Redis. Supports multiple scopes (`API_KEY`, `RECIPIENT`, `TEMPLATE`) and dynamic hierarchy (the tightest scope wins).
- **Email & SMS Notifications:** Supports multiple channels for outreach.
- **Real-Time Webhooks:** Receive signed HTTP POST callbacks to your backend when a notification is `SENT`, `DELIVERED`, `FAILED`, or `RATE_LIMITED`.
- **Background Jobs:** Utilizes BullMQ and Redis for reliable asynchronous job processing, ensuring your API requests never block.
- **Idempotency:** Native support for idempotency keys to prevent duplicate notifications.
- **Modern Dashboard:** Next.js frontend integrated with Clerk for seamless authentication, API key generation, rate limit rule configuration, and webhook monitoring.

---

## Architecture & Tech Stack

### Backend
- **Framework:** Node.js with Express
- **Language:** TypeScript
- **Database:** PostgreSQL (with Prisma ORM)
- **Queue/Cache:** Redis & BullMQ (using isolated workers for Email, SMS, and Webhooks)
- **Integrations:** Resend (Email), Twilio (SMS)

### Frontend (Dashboard)
- **Framework:** Next.js 14
- **Authentication:** Clerk
- **UI:** Tailwind CSS, Base UI, Lucide Icons

---

## API Documentation & Usage

### 1. Authentication
All API requests require your tenant API key to be passed in the `Authorization` header as a Bearer token. You can generate and revoke API keys from your dashboard.

```http
Authorization: Bearer YOUR_API_KEY
```

### 2. Sending Notifications (`POST /v1/notify`)
Submits a new notification to the queue. RateGate will automatically evaluate your active Rate Limit Rules before accepting the payload.

**Endpoint:** `POST /v1/notify`

**Body Parameters:**
- `channel` (string, required): `EMAIL` or `SMS`
- `recipient` (string, required): Email address or Phone number with country code.
- `subject` (string, optional): Required if channel is `EMAIL`.
- `body` (string, optional): Raw body of the notification.
- `templateName` (string, optional): Name of a pre-configured template. (Must provide either `body` or `templateName`).
- `variables` (object, optional): Key-value pairs for template variable substitution.
- `idempotencyKey` (string, optional): Unique key to prevent duplicate sends on network retries.

**Example Request:**
```bash
curl -X POST https://api.rategate.dev/v1/notify \
  -H "Authorization: Bearer nk_live_xxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "templateName": "welcome_email",
    "variables": { "name": "Alice" },
    "idempotencyKey": "req_12345"
  }'
```

**Responses:**
- `202 Accepted`: Notification passed rate limits and is queued.
- `429 Too Many Requests`: Notification was blocked by a rate limit rule. Returns the scope that triggered the block.
- `200 OK`: Duplicate request (if `idempotencyKey` was previously used).

### 3. Fetching Notifications (`GET /v1/notifications`)
Paginated endpoint to audit sent and failed notifications.

**Endpoint:** `GET /v1/notifications`

**Query Parameters:**
- `status`: `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `RATE_LIMITED`
- `channel`: `EMAIL` or `SMS`
- `limit`: Number of results (default 25, max 100)
- `cursor`: Pagination cursor

### 4. Fetching a Single Notification (`GET /v1/notify/:id`)
Retrieve the exact status, timestamps, and error messages for a specific notification. If the notification was rate-limited, it includes the exact rule that caused the rejection.

---

## Rate Limiting

RateGate evaluates limits in a specific hierarchy:
1. **`TEMPLATE` scope:** Limits how often a specific template is used (e.g., OTPs or Password Resets).
2. **`RECIPIENT` scope:** Limits how many notifications a single user/recipient can receive globally.
3. **`API_KEY` scope:** Limits total throughput for your tenant/API key.

When multiple rules apply, RateGate uses a "peek and commit" strategy in Lua to determine the tightest limit. It ensures that if a tight scope (like `TEMPLATE`) blocks a request, the wider scopes (like `API_KEY`) do **not** consume their quota, preventing a single abused endpoint from exhausting your global limit.

---

## Webhooks (v2)

Instead of polling `GET /v1/notify/:id` to check if an email was delivered, you can configure a Webhook URL in the RateGate dashboard. RateGate will send a `POST` request to your endpoint whenever a notification's status changes.

### Webhook Events
- `notification.sent`
- `notification.delivered`
- `notification.failed`
- `notification.rate_limited`

### Webhook Payload Example
```json
{
  "event": "notification.failed",
  "timestamp": "2026-07-22T00:00:00.000Z",
  "data": {
    "notificationId": "uuid-here",
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "status": "FAILED",
    "errorMessage": "SMTP connection timeout"
  }
}
```

### Verifying Webhook Signatures
RateGate signs every webhook payload using HMAC-SHA256 and your Webhook Secret.
1. Read the `X-RateGate-Signature` header (format: `sha256=HEX_STRING`).
2. Compute the HMAC-SHA256 signature of the raw request body using your Webhook Secret.
3. Use a constant-time string comparison (e.g., `crypto.timingSafeEqual` in Node.js) to compare your computed signature with the header.

---

## Local Development & Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL (or Docker Desktop to run it locally)
- Redis (or Docker Desktop to run it locally)
- API Keys for Resend, Twilio, and Clerk

### Installation

1. Copy `.env.example` to `.env` and fill in your variables.
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start PostgreSQL and Redis:
   ```bash
   docker-compose up -d
   ```

4. Setup Database:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. Start the API & Dashboard (concurrently):
   ```bash
   npm run dev
   ```

### Worker Nodes
To process background notifications and webhooks, you must run the background workers. These operate independently of the API server.
```bash
# In separate terminal tabs:
npm run worker:email
npm run worker:sms
npm run worker:webhook
```

### Running Tests
The project contains comprehensive unit and integration tests using Jest.
```bash
npm run test
```
*Note: Make sure your local Redis instance is running before executing tests.*

---

## License
ISC
