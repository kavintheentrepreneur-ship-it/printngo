# Printngo - Self-Service QR Printing Kiosk

A complete, self-service printing kiosk system. A customer scans a QR code on a laptop kiosk, opens the Printngo mobile web app, uploads a file, configures print options (size, color, single/duplex, N-up pages-per-sheet, copies), pays via UPI (GPay/PhonePe intent or Razorpay gateway), and the kiosk prints the job automatically.

---

## Architecture & Monorepo Structure

```
├── apps/
│   ├── customer-web/      # Mobile web app served at /s/:token (Next.js App Router, Tailwind CSS, TanStack Query)
│   ├── kiosk-web/         # Fullscreen kiosk display at /kiosk (Next.js App Router, Chromium kiosk mode)
│   ├── api/               # NestJS backend (REST API, Socket.IO gateway, webhooks, Prisma ORM)
│   └── print-agent/       # Local Node.js + TypeScript printing daemon for the kiosk laptop
├── packages/
│   └── shared/            # Shared types, enums, Zod schemas, integer pricing engine, state machine, machine adapter
├── infra/
│   ├── docker-compose.yml # PostgreSQL 16, MinIO (S3 compatible), LibreOffice headless converter
├── docs/
│   ├── kiosk-setup.md     # Windows 11 / Ubuntu launcher, power settings, printer dispatch setup
│   ├── staff-manual.md    # Daily staff guide: manual UPI confirmations, reprints, refunds, pricing updates
│   └── launch-checklist.md# Go-live requirements, security verification, and checklist
└── .env.example           # Complete environment variable templates
```

---

## Quickstart & Local Development

### 1. Prerequisites
- **Node.js** v20+ or v24+
- **pnpm** v9+ (`corepack enable pnpm` or `npm install -g pnpm`)
- **Docker & Docker Compose** (for PostgreSQL, MinIO, and LibreOffice converter)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure required secrets (`DATABASE_URL`, `STORAGE_*`, `RAZORPAY_*`, etc.) are configured.

### 3. Start Local Infrastructure
```bash
docker compose -f infra/docker-compose.yml up -d
```
Services started:
- **PostgreSQL**: `localhost:5432` (database: `printngo_db`, user: `printngo`)
- **MinIO S3**: `localhost:9000` (API) and `localhost:9001` (Console)
- **LibreOffice API**: `localhost:3005` (Gotenberg document converter)

### 4. Install Dependencies & Build
```bash
pnpm install
pnpm build
```

### 5. Run Database Migrations & Seeds
```bash
pnpm --filter @printngo/api prisma migrate dev
pnpm --filter @printngo/api prisma db seed
```

### 6. Start Development Servers
Run all or individual services:
```bash
# Start API
pnpm dev:api

# Start Customer Mobile App (http://localhost:3000)
pnpm dev:customer

# Start Kiosk Web Display (http://localhost:3001/kiosk)
pnpm dev:kiosk

# Start Kiosk Print Agent
pnpm dev:agent
```

---

## Running Automated Tests

Run unit tests across the monorepo:
```bash
pnpm test
```

Run end-to-end Playwright tests (simulating customer mobile flow & kiosk queue):
```bash
pnpm --filter @printngo/customer-web test:e2e
```

---

## Domain Rules & Integrity Guarantees

1. **Integer Money**: All monetary calculations are performed in **paise** (integers) exclusively in `@printngo/shared`. Floating point arithmetic is strictly forbidden.
2. **State Machine**: Job states (`draft` → `awaiting_payment` → `paid` → `queued` → `printing` → `completed`) can only be modified by the backend and valid transitions are enforced with `409 Conflict`.
3. **Price Lock**: Options can only be edited in `draft`. Once moving to `awaiting_payment`, the price is immutably locked.
4. **Verified Payment Only**: Customer never sees the Thank You screen without verified gateway webhook capture or authenticated staff confirmation.
5. **Security & Privacy**: Uploaded customer files are automatically purged after 7 days by a scheduled worker.
