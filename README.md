# Houseboat — Booking SaaS

Multi-tenant houseboat booking platform (Bangladesh market). One boat, many owners; one login, many roles. DB-enforced no-double-booking, exact money math, per-boat RBAC, offline-capable owner ops.

See [`plan/`](plan/) for the source-of-truth spec:
- `houseboat_schema.md` — 41 tables, 7 modules
- `houseboat_logic.md` — every business rule the system enforces
- `houseboat (1).dbml` — the diagram (dbdiagram.io)

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node 24 |
| Pkg manager | pnpm (workspace) |
| Backend | NestJS + Prisma (PostgreSQL) |
| Realtime | Socket.io |
| Cache / rate-limit | Redis (ioredis) |
| Auth | JWT in HttpOnly cookies + CSRF, bcryptjs |
| Storage | S3 / Cloudflare R2 (@aws-sdk) + sharp |
| Frontend | Next.js + React, TailwindCSS, SWR, Leaflet, i18next |
| Deploy | Backend → Railway, Frontend → Vercel |

## Layout

```
houseboat/
├── backend/      NestJS API + Prisma schema/migrations
├── frontend/     Next.js app
└── plan/         Spec (source of truth)
```

## Getting started

Prereqs: Node 24, pnpm 9, a PostgreSQL 16 database, Redis.

```bash
pnpm install

# backend
cp backend/.env.example backend/.env      # set DATABASE_URL, REDIS_URL, JWT_SECRET
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate      # apply schema
pnpm --filter backend db:seed             # optional demo data

# frontend
cp frontend/.env.example frontend/.env.local

# run both
pnpm dev
```

API on `http://localhost:4000`, web on `http://localhost:3000`.

## Build order

1. Foundation — schema + DB-level constraints (hold uniqueness, append-only audit, UTC)
2. Identity + per-boat RBAC (IDOR re-checks on every fetch)
3. Assets, trips, pricing
4. Holds + booking (concurrency-critical)
5. Money — invoices, payments, refunds, payouts
6. Ops + HR — costs, inventory, crew, payroll
7. Offline sync — append-only intent replay
