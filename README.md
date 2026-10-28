# MH MoneyGram Customer Self-Service Portal

A responsive React + TypeScript demonstration portal for MH MoneyGram customer services. The interface covers foreign exchange, international transfers, membership, wallet views, regulatory limits, statements, KYC, notifications, branches, and support.

## Important status

This repository runs in **demonstration mode** by default. All customers, balances, rates, regulatory limits, transactions, bookings, and statuses are sample data. No real financial transaction, compliance decision, wallet entry, authentication event, or identity verification occurs in the browser.

Production activation requires approved backend integrations, security review, regulatory approval, and confirmation of MH MoneyGram's licensed capabilities.

## Stack

- React + TypeScript + Vite
- Tailwind CSS with project-local shadcn-style UI primitives
- React Router
- TanStack Query and TanStack Table
- React Hook Form + Zod
- Zustand
- Recharts
- Decimal.js for decimal-safe quote arithmetic
- date-fns and Lucide React

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:4173`. The public demonstration build opens directly to the sample dashboard. Authentication routes remain available for future backend integration.

## Build and test

```bash
npm run build
npm run test
```

The production build is emitted to `dist/`.

## Architecture

```text
src/
  app/          route shell and pages
  components/   reusable UI and brand components
  data/         clearly labelled demonstration data
  services/     typed adapter boundary
  stores/       lightweight client state
  types/        domain and API contracts
  utils/        decimal-safe money helpers
```

The `ApiAdapter` interface in `src/types/index.ts` defines the initial typed integration seam. `src/services/api.ts` exports the mock adapter and is the single replacement point for an approved backend implementation.

## Security notes

- The demo session is intentionally non-production and held only in memory.
- Never put production tokens, identity documents, private keys, customer data, or provider credentials in the frontend.
- Production authentication should use secure, backend-managed sessions and CSRF protections where applicable.
- Wallet balances, rates, compliance decisions, statement data, QR verification tokens, and transaction statuses must be backend-authoritative.
- Mutating financial requests require server-issued references, idempotency keys, audit events, and reversal workflows.

See [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md) for the proposed contracts and readiness checklist.
