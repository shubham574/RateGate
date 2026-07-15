# RateGate

RateGate is a Multi-tenant Notification API with Built-in Rate Limiting. It provides an robust back-end set up to handle emails and SMS notifications gracefully, backed by Next.js dashboard for tenant management.

## Features

- **Multi-tenant Architecture:** Easy isolation and management for multiple organizations/tenants.
- **Robust Rate Limiting:** Built-in safeguards against API abuse and notification flooding using Redis.
- **Email & SMS Notifications:** Integration with Resend (Emails) and Twilio (SMS).
- **Background Jobs:** Utilizes BullMQ and Redis for reliable asynchronous job processing.
- **Modern Dashboard:** Next.js 14 frontend integrated with Clerk for seamless authentication and tenant provisioning.

## Tech Stack

### Backend
- **Framework:** Node.js with Express
- **Language:** TypeScript
- **Database:** PostgreSQL (with Prisma ORM)
- **Queue/Cache:** Redis & BullMQ
- **Integrations:** Resend, Twilio

### Frontend (Dashboard)
- **Framework:** Next.js 14
- **Authentication:** Clerk

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Redis
- API Keys for Resend, Twilio, and Clerk

### Installation

1. Copy `.env.example` to `.env` and fill in your variables.
2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup Database:
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

### Worker Nodes
To process background notifications, run the workers:
```bash
npm run worker:email
npm run worker:sms
```

## License
ISC
