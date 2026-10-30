# MH MoneyGram Customer Self-Service Portal

A responsive React + TypeScript customer portal integrated with the existing ERPNext/Frappe `moneygram` app. The interface covers foreign exchange, international transfers, membership, transaction history, an ERPNext-accounted FJD wallet, regulatory limits, statements, KYC, notifications, gifting, branches, and support.

## Important status

Authentication, customer signup, profile/KYC, membership cards, forex requests, money-transfer requests, request receipts, unified Forex/Transfer history, wallet workflows, customer statements, the dashboard, notifications, the RBF 2026 My Limits catalogue, and Help & Support use live ERPNext data. The portal creates operator-reviewable requests; it does not complete financial transactions in the browser.

Notifications now use the authenticated customer's standard ERPNext `Notification Log`, including live unread counts and status alerts for Forex, Money Transfer, wallet, KYC and membership workflows. The separate activity-analytics page, branches, appointments and settings still contain mock, static or placeholder content. Help & Support reads the live email and telephone from ERPNext Company and creates customer-linked ERPNext Issue records. The dashboard itself uses customer-owned ERPNext wallet, request, membership and compliance records. Consolidated, Forex, Money Transfer and posted-wallet statements support live preview plus ERPNext-generated PDF/CSV output. My Limits displays the policy catalogue and counts only dedicated operator-linked compliance-ledger records; it deliberately does not infer usage from legacy free-text purposes.

`Gift Your Loved Ones` is a clearly labelled frontend prototype. It currently provides sample products, categories, Fiji store locations, delivery/pickup selection, gift wrapping, multiple sample payment choices and a downloadable/printable gift card. It does not create a live order or payment and is not yet connected to an e-commerce platform.

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

Open `http://127.0.0.1:4173`. The current local-development configuration proxies `/api` requests to the public ERPNext endpoint at `https://moneygram.advtinni.com`.

## Install as a Frappe app

This repository is also an installable Frappe website app named `mmel_customer_portal`. It is intentionally separate from, and declares a dependency on, the existing `moneygram` app that owns the live APIs and custom DocTypes.

Build the committed Frappe page and assets before packaging or deployment:

```bash
npm ci
npm run build:frappe
```

The Frappe build is written to `mmel_customer_portal/public/customer_portal/`, and its generated website page is written to `mmel_customer_portal/www/customer_portal.html`. After the repository is present under the bench `apps` directory, install and expose it with:

```bash
cd /home/erpnext/frappe-mmel
bench --site mmel.local install-app mmel_customer_portal
bench build --app mmel_customer_portal
bench --site mmel.local clear-cache
```

The portal is then served by the same ERPNext origin at `/customer-portal`. Nested React routes also resolve through Frappe, so URLs such as `/customer-portal/login` and `/customer-portal/dashboard` work on refresh. Existing `/verify-card/...` QR links redirect to the new portal path. API requests use same-origin `/api` URLs; no production ERPNext hostname is embedded in the application bundle.

The server's existing `moneygram` app must already include the portal API and DocType files mirrored under `erpnext/moneygram/`. Installing `mmel_customer_portal` does not overwrite that app.

## Build and test

```bash
npm run build
npm run test
```

The production build is emitted to `dist/`.

Use `npm run build:frappe` for the installable ERPNext/Frappe bundle rather than the standalone `dist/` build.

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

Live ERPNext clients are under `src/services/`. The legacy `ApiAdapter` and `src/services/api.ts` remain only for unfinished mock modules and must not be used as an authority for live financial data.

## Security notes

- Authentication uses the backend-managed Frappe session cookie and CSRF token.
- Never put production tokens, identity documents, private keys, customer data, or provider credentials in the frontend.
- Every customer API must enforce Customer and portal-user ownership on the server.
- Wallet balances, rates, compliance decisions, statement data, QR verification tokens, and transaction statuses must be backend-authoritative.
- Mutating financial requests require server-issued references, idempotency keys, audit events, and reversal workflows.

See [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md) for the proposed contracts and readiness checklist.
