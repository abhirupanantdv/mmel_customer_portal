# Persistent Development Instructions

These instructions apply to the entire repository.

## Project state

- Read `DEVELOPMENT_HANDOVER.md` before making changes. It is the current implementation/status reference.
- This is a hybrid React and ERPNext/Frappe project. Authentication, profile/KYC, membership, forex requests, money-transfer requests, their PDF receipts, unified request/transaction history, the FJD wallet, statements, limits, dashboard, notifications, and Help & Support are live integrations. Other modules still use mocks or placeholders.
- Wallet balances, requests, ledger entries, request receipts, PDF statements and loyalty summaries are live ERPNext data. Do not reintroduce mock wallet values.
- `Gift Your Loved Ones` is currently an explicitly labelled frontend prototype using sample catalogue, store and checkout data. Do not connect payment buttons, debit the live wallet, or describe sample orders as persisted until the e-commerce, fulfilment and payment contracts are approved.
- Preserve existing uncommitted work. Inspect `git status` and relevant diffs before editing; never reset or discard user changes.

## Scope and source layout

- Frontend source is under `src/`.
- Portal-specific ERPNext source is mirrored under `erpnext/moneygram/` and must remain compatible with the existing server app.
- Brand assets must be reused exactly. Do not redraw or retype the MH Money Express logo.
- Keep application behavior unchanged when a request is documentation-only.

## Frontend conventions

- Use TypeScript and the existing React Router, Zustand and service patterns.
- Put ERPNext calls in typed modules under `src/services/`; do not call API endpoints directly from page components.
- Reuse `frappeRequest`, `formBody`, cookie credentials and CSRF handling from `src/services/auth.ts`.
- Treat same-origin `/api` as the production default. The Vite proxy is for local development.
- The current Vite development proxy target is the public endpoint `https://moneygram.advtinni.com` because development is occurring outside the office network. Production still uses same-origin `/api`; do not hardcode this public development target in application services.
- Keep monetary values decimal-safe and include explicit currencies. The server remains authoritative for rates and final amounts.
- Implement responsive behavior for desktop and mobile with accessible labels, keyboard operation, loading states and customer-safe errors.
- Do not add production secrets, bearer tokens or customer data to frontend code, local storage, fixtures or logs.
- Prefer splitting new page modules out of `src/app/pages.tsx` rather than making that file larger.

## ERPNext/Frappe conventions

- Require an authenticated Frappe session for customer APIs unless an endpoint must be public, such as signup.
- Enforce customer ownership/isolation server-side on every read and mutation.
- Use whitelisted method restrictions, server-side input validation, permission checks and translated customer-facing errors.
- Financial portal actions create operator-reviewable requests; they do not directly complete operational transactions.
- Wallet funding and withdrawal requests never change balances until a permitted ERPNext operator approves them. Approval must submit a balanced Journal Entry and atomically append an immutable `Customer Wallet Transaction`.
- Keep ERPNext Loyalty Program points separate from the withdrawable FJD balance. Do not create or guess earning/redemption rules in portal code.
- Rates, branch availability, eligibility, KYC approval, card activation and provider references are server-authoritative.
- Signup must continue to create matching Customer and Supplier IDs, a Contact linked to both, and a pending membership card.
- Membership profile approval must require verified identity evidence, proof of address and customer photo. Card approval follows profile approval. Do not weaken this workflow without explicit business approval.
- Membership card numbers are 16 digits, grouped in fours, with the `6234` prefix. Preserve a legacy card's identity by inserting four zeroes after the prefix when expanding the former 12-digit format; do not issue a different number during migration.
- Membership PDFs use the supplied front/back raster templates and an exact two-page 86 x 54 mm image-based renderer. Company phone, email and website must come from the default ERPNext Company record; do not restore hardcoded demo contact details or browser-based PDF layout.
- Store portal evidence in `Customer Portal KYC Document`; do not reintroduce dependencies on nonexistent `RBF Evidence` or `RBF Document Type` DocTypes.
- Preserve audit fields and status-transition validation in custom DocTypes.
- Forex and money-transfer receipts must use the ERPNext request ID, enforce ownership against both Customer and portal user, and state that a submitted request is not proof of a completed transaction.
- Keep receipt generation server-side. Print and download controls may expose only authenticated, ownership-checked PDF endpoints.
- Unified transaction history currently includes only customer-owned Forex and Money Transfer request records. Do not mix in mock wallet entries or raw legacy imports; expose completed operational references only through validated request links.
- Statements are generated server-side from customer-owned ERPNext records. Consolidated statements may combine Forex and Money Transfer requests with posted wallet ledger entries, but must preserve their different meanings and include the request-versus-settlement disclaimer.
- Statement periods are limited to 366 days. PDF and CSV downloads must enforce customer and portal-user ownership on the server; never build an authoritative statement from frontend mock data.
- My Limits uses the RBF policy effective 1 January 2026 and the dedicated `Customer Exchange Control Usage` ledger. Never infer compliance usage from free-text purpose fields or merge unrelated delegated limits. An operator-linked source record is required for authoritative usage.
- Dashboard figures must come from `customer_portal_dashboard.get_dashboard`. Keep submitted request volumes distinct from posted wallet ledger movements, and never reintroduce sample balances, bookings, transactions or counters.
- Help & Support contact details must come from the default ERPNext Company record; do not hardcode an email address or telephone number. Portal tickets are standard ERPNext `Issue` records linked server-side to both the authenticated Customer and portal user's email, and ticket history must enforce both ownership filters.
- Portal notifications use ERPNext's standard `Notification Log`. Every portal inbox/count/read query must filter by the authenticated session user's exact `for_user` value; never accept a user or customer selector from the browser. Status-alert hooks must remain non-blocking so a notification failure cannot roll back the underlying business operation.
- Use tabs for indentation in Frappe Python files to match the existing app style.

## Server and deployment safety

- Public ERPNext URL: `https://moneygram.advtinni.com`.
- Public SSH uses `erpnext@moneygram.advtinni.com` on port `22422`.
- Office-network SSH uses `erpnext@192.168.101.182` on port `22`; the office HTTP endpoint is `http://192.168.101.182:83`.
- Bench: `/home/erpnext/frappe-mmel`; site: `mmel.local`; app: `moneygram`.
- Never record or expose the SSH password or other credentials.
- Before modifying the server, verify the destination and inspect the current remote file/repository state with read-only commands.
- Make and review changes locally first. Deploy only the intended files, and do not overwrite unrelated remote changes.
- Run `bench --site mmel.local migrate` for DocType/schema changes, then clear cache/restart only as needed.
- Use rollback-safe test data and remove synthetic production records after verification.
- Do not run destructive Git, database, bench or filesystem commands without explicit authorization and exact target validation.

## Required verification

For frontend changes, run:

```bash
npm run build
npm run test
git diff --check
```

For ERPNext changes, also syntax-check modified Python, validate DocType JSON, migrate when the schema changed, and smoke-test both allowed and denied workflows. Test customer isolation and operator status transitions for every new API.

Do not claim deployment, migration, successful tests or production behavior unless it was actually verified. Report skipped checks and remaining risks clearly.

## Documentation discipline

- Update `DEVELOPMENT_HANDOVER.md` when a module becomes live, a schema/API changes, a known bug is resolved, or a new blocker is discovered.
- Keep `README.md` and `docs/API_INTEGRATION.md` aligned with the live/mock boundary when implementation work changes it.
- Never include passwords, tokens, private keys, real KYC files or personal customer data in documentation.
- For documentation-only requests, edit documentation only and verify the application working tree is otherwise unchanged by the task.
