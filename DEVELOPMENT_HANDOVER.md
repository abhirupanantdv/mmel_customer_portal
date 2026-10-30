# MH MoneyGram Customer Portal — Development Handover

Last updated: 30 October 2026

## 1. Project architecture and technology stack

### System overview

The project is a customer self-service portal with two cooperating parts:

1. A React single-page application in this repository.
2. API methods and custom DocTypes for the existing ERPNext/Frappe `moneygram` app.

The React frontend is now also packaged as a separate installable Frappe app named `mmel_customer_portal`. It depends on the existing `moneygram` app, serves the SPA at `/customer-portal`, publishes built files under `/assets/mmel_customer_portal/customer_portal/`, and routes nested browser paths back to the generated React entry page. Production API traffic remains same-origin under `/api`.

Vite serves the local frontend at `http://127.0.0.1:4173`. The current development proxy sends `/api` to `https://moneygram.advtinni.com` because development is occurring outside the office network. When the portal is installed in Frappe, the intended production arrangement is same-origin frontend and `/api` traffic.

```text
Browser
  |
  | React routes, forms, session cookie and CSRF token
  v
Vite development server (local) or Frappe web server (production)
  |
  | /api/method/moneygram.moneygram.api.*
  v
Frappe / ERPNext moneygram app
  |
  +-- User, Customer, Supplier, Contact, Address
  +-- Item, Item Price, Warehouse and Price List
  +-- Customer Forex Request
  +-- Customer Money Transfer Request
  +-- Customer Portal KYC Document
  +-- Customer Membership Card
```

### Frontend stack

- React with TypeScript
- Vite
- React Router
- Zustand for session state
- TanStack Query and TanStack Table
- React Hook Form and Zod
- Recharts
- Decimal.js for decimal-safe monetary calculations
- date-fns
- Lucide React icons
- Tailwind tooling plus project-local CSS and UI primitives
- Vitest and Testing Library

Important frontend locations:

```text
src/App.tsx                 Route definitions and protected-route boundary
src/app/AppShell.tsx        Authenticated navigation shell
src/app/LandingPage.tsx     Public landing page
src/app/pages.tsx           Portal page implementations
src/services/               ERPNext API clients and legacy mock adapter
src/stores/session.ts       Session restoration, sign-in and sign-out state
src/data/mock.ts            Data still used by unfinished modules
src/types/                  Shared domain contracts
src/utils/                  Money helpers and unit tests
src/styles.css              Responsive application and landing-page styles
```

### ERPNext/Frappe integration

Local copies of the deployed additions are under:

```text
erpnext/moneygram/moneygram/api/
erpnext/moneygram/moneygram/doctype/
```

The APIs use Frappe's authenticated website session, CSRF protection, whitelisted methods, server-side permission checks, validation, and ERPNext as the authoritative data source. The principal modules are:

- `customer_portal_auth.py`: signup and current-session identity.
- `customer_portal_profile.py`: customer profile, address and KYC evidence.
- `customer_portal_membership.py`: membership provisioning, photo upload, card state and PDF.
- `customer_portal_forex.py`: currency/branch options, live estimates, exchange requests and customer-owned PDF receipts.
- `customer_portal_money_transfer.py`: destination/branch options, transfer requests and customer-owned PDF receipts.
- `customer_portal_transactions.py`: customer-isolated unified Forex/Transfer request history and transaction details.
- `customer_portal_statements.py`: customer-isolated consolidated, Forex, Money Transfer and posted-wallet PDF/CSV statements.
- `customer_portal_limits.py`: RBF 2026 delegated-limit catalogue and customer-isolated compliance-usage summaries.
- `customer_portal_dashboard.py`: customer-isolated dashboard snapshot and six-month activity series.
- `customer_portal_notifications.py`: customer-isolated ERPNext Notification Log inbox, unread state and status-alert helpers.
- `customer_portal_support.py`: Company contact details and customer-isolated ERPNext Issue creation/history.

The custom DocTypes are:

- `Customer Forex Request`
- `Customer Money Transfer Request`
- `Customer Portal KYC Document`
- `Customer Membership Card`
- `Customer Wallet Settings`
- `Customer Wallet`
- `Customer Wallet Request`
- `Customer Wallet Transaction`
- `Customer Exchange Control Usage`

### Environment and deployment reference

- Public ERPNext URL: `https://moneygram.advtinni.com`
- Office-network ERPNext URL: `http://192.168.101.182:83`
- Public SSH endpoint: `erpnext@moneygram.advtinni.com` on port `22422`
- Office-network SSH endpoint: `erpnext@192.168.101.182` on port `22`
- Bench directory: `/home/erpnext/frappe-mmel`
- Frappe site: `mmel.local`
- Existing app: `moneygram`

Do not store the SSH password, API secrets, customer documents, or production credentials in this repository. Confirm the remote hostname and Git/app paths with read-only commands before deploying changes.

## 2. Completed features

### Public and authentication experience

- Public landing page before sign-in/sign-up.
- MH Money Express branding and the tagline “Your International Wallet”.
- Responsive desktop and mobile navigation.
- Mobile login layout correction.
- ERPNext session-based sign-in, sign-out and session restoration.
- Customer registration with validation and rate limiting.
- Signup creates a website User, Customer, Supplier, Contact and membership card.
- Customer and Supplier use the same ERPNext ID, and the Contact is linked to both.

### Profile and KYC

- Live profile retrieval and update against ERPNext Customer, Contact and Address records.
- KYC document upload with document type, number and expiry metadata.
- KYC upload separates the high-level document type (Proof of Identity, Proof of Address or Photo) from the specific document name, and previews selected images/PDFs before submission.
- Supported evidence includes passport, driver licence, voter ID, TIN evidence, official ID, proof of address and customer photograph.
- Dedicated `Customer Portal KYC Document` records with Draft, Verified and Rejected review states.
- ERPNext operator actions to verify or reject KYC evidence.
- Profile completeness and KYC state shown in the customer portal.
- Client-side image compression for profile/card photos: maximum dimension 1400 px, JPEG quality 0.84. This mitigates Frappe request-size errors from large phone photos.

### Membership card

- Membership card is provisioned at signup, not deferred until photo upload.
- Existing eligible portal customers were backfilled with cards on the server.
- Live card state, cardholder identity, photo, issue date and validity date.
- Photo upload/capture from the portal.
- Separate operator review states for profile and card.
- Card remains pending until operator approval.
- Profile approval requires all of the following KYC records in `Verified` state:
  - At least one identity document: passport, driver licence, voter ID, TIN evidence or official ID.
  - Proof of address.
  - Customer photograph.
- Card approval requires profile approval and a verified photo.
- Both approvals activate the card for two years and record approval audit details.
- Active cards can be downloaded/printed as a two-sided generated PDF using the supplied front/back artwork.
- Each card has a dedicated 16-digit number (`6234` prefix plus a twelve-digit ERPNext series), grouped in fours. The former 12-digit values were expanded without changing their sequence identity; for example, `6234 0000 0001` became `6234 0000 0000 0001`.
- Front and back use the supplied white/red globe design, embedded chip/contactless artwork and exact logo asset.
- The supplied front template displays the tagline “Your International Wallet”. The back reads the current phone, email and website from the default ERPNext Company record.
- Download/print output is rendered as two exact 86 x 54 mm image-based PDF pages. This avoids the SVG tiling, A4 whitespace and overlapping content produced by the previous browser/PDF renderer.
- Each card has a high-entropy verification token. The printed QR opens `/customer-portal/verify-card/:token`, a public read-only check that exposes only card number, cardholder, current status and validity date.
- Private membership photographs are returned as authenticated image data so they render through the local proxy and same-origin production deployment.
- Exact supplied membership-card logo/artwork is used rather than recreated text.

### Foreign exchange

- Buy and sell request modes.
- Available currencies and rates sourced from ERPNext Item Price configuration.
- Available branch locations sourced from active Warehouse records.
- Branch-specific estimates with ERPNext as the authoritative rate source.
- Customer submission creates a `Customer Forex Request` for operator review.
- Operator request status lifecycle and completion reference validation.
- Customer request-list API.
- Customer-owned PDF request receipts with the ERPNext request ID, available for print/download after submission and from recent requests.
- Requested UI copy and FJD `F$` total formatting changes.

### Money transfer

- Destination country/currency options sourced from Item configuration.
- Available branches sourced from Warehouse records.
- Recipient, purpose, source-of-funds and amount collection.
- Customer submission creates a `Customer Money Transfer Request` for operator review.
- Operator status actions and provider/reference controls.
- Customer request-list API.
- Customer-owned PDF request receipts with the ERPNext request ID, available for print/download after submission and from recent requests.
- Public-server API module path corrected and deployed.

### General user interface

- Protected customer route shell with desktop sidebar and mobile navigation.
- Dashboard and routes for forex, transfer, gifts, wallet, transactions, statements, limits, activity, branches, notifications, support and settings.
- Customer Portal label removed below the sidebar logo.
- Demonstration banners and requested implementation messages removed from the live forex/transfer experience.
- Responsive styling for the landing page, authentication pages and portal pages.

### Dashboard

- Live wallet available/held balances, open/completed/total request counts, membership/profile-review state, and compliance-ledger counts.
- Latest open request with its actual ERPNext status, branch and ownership-checked detail link.
- Five recent customer-owned Forex/Money Transfer requests.
- Six-month submitted Forex/Transfer request-volume chart and separate posted-wallet credit/debit chart.
- Loading, error, retry and empty states; no dashboard balance, booking, transaction or counter uses mock data.

### Transactions

- Live unified history for customer-owned Forex Exchange and Money Transfer requests.
- Search by request/reference, branch, country, recipient and operational reference.
- Type and status filters, pagination and summary counts.
- Live transaction/request detail pages with ERPNext-recorded amounts and statuses.
- Completed operational references appear when linked or recorded by an operator.
- CSV export of the current filtered page.
- Print/download actions reuse the ownership-checked request receipt endpoints.
- Mock wallet entries and raw legacy imported records are intentionally excluded.

### Wallet

- Live FJD wallet summary with available, held and total balances from ERPNext.
- One customer-owned wallet per Customer, linked to the portal user.
- Operator-reviewable funding and withdrawal requests with configurable minimum/maximum amounts and payment references.
- Approval submits a balanced ERPNext Journal Entry before atomically posting the wallet ledger and balance.
- Dedicated `Customer Wallet Clearing - MME` Current Asset and `Customer Wallet Liability - MME` Current Liability accounts.
- Immutable wallet transaction records with idempotency keys, balance snapshots, source request, operator and Journal Entry references.
- Customer isolation on wallet summary, request history, ledger history, receipts and statements.
- Wallet request PDF receipts and date-range PDF statements.
- Native ERPNext Loyalty Program summary and recent point entries, displayed separately from cash.
- The current site has no configured Loyalty Program, so the portal shows the programme as not configured rather than inventing points.

### Statements

- Live statement builder for consolidated activity, Forex requests, Money Transfer requests and posted wallet ledger entries.
- Date ranges are validated server-side and limited to 366 days.
- Live preview provides record counts by activity type, currency credit/debit totals and recent records.
- Customer-owned PDF and CSV downloads are generated by ERPNext; PDF statements can also be opened for printing.
- Consolidated statements preserve the distinction between request records and posted wallet entries and include a settlement disclaimer.
- Regulatory-usage statements remain unavailable until completed operational transactions are consistently mapped into the new compliance-usage ledger.

### Help and support

- Company email and telephone are read live from the default ERPNext Company record; contact details are not hardcoded in the portal.
- Authenticated customers can create support tickets as standard ERPNext `Issue` records.
- Each Issue is linked server-side to the resolved Customer, portal user's email and Company, with a valid ERPNext Issue Priority.
- Customers can view their own Issue status, priority, modification time and operator resolution in the portal.
- Ticket history is isolated by both Customer and `raised_by`; no customer identifier is accepted from the browser.
- Ticket creation is limited to ten requests per authenticated user per hour.

### Notifications

- Live inbox backed by ERPNext's standard `Notification Log`; the original sample notifications were removed.
- Inbox supports All/Unread filters, refresh, individual read state and Mark all as read.
- Sidebar and topbar badges show the authenticated customer's live unread count and refresh every 60 seconds.
- Forex request, Money Transfer request, wallet request, KYC evidence and membership-review status changes create alerts for the linked portal user.
- Alert links are restricted to known customer-safe portal routes; arbitrary ERPNext document routes are never exposed.
- All list, count and read operations are isolated by the exact authenticated `for_user` value, and status-alert insertion is non-blocking so it cannot prevent an operator transaction from saving.

### Gift Your Loved Ones prototype

- New protected `/gifts` module and sidebar navigation entry.
- Ten sample gift products with photographs and descriptions across Flowers & Hampers, Celebrations, Fashion & Beauty, Tech & Lifestyle, and Kids & Family.
- Category, subcategory and text-search browsing plus an interactive quantity-controlled gift bag.
- Sample Fiji pickup locations for Suva, Nadi, Lautoka and Labasa, or a home-delivery form with preferred date.
- Gift wrapping, wrapping-style selection, recipient/sender details and a personal gift-card message.
- Sample payment choices for MH Wallet, M-PAiSA/M-Pesa, MyCash, card, bank transfer and MoneyGram Inbound.
- Browser-session-only sample order confirmation with a branded shareable gift card that can be downloaded as SVG or opened for printing.
- Explicit prototype notices confirm that no payment, live wallet debit, inventory reservation, e-commerce order or fulfilment request occurs.

## 3. Current development progress

### Frappe application packaging

- The repository contains standard Frappe package metadata (`setup.py`, `pyproject.toml`, `MANIFEST.in` and the `mmel_customer_portal` Python package).
- `npm run build:frappe` creates the production bundle with the Frappe asset prefix and synchronises its generated HTML into the website page.
- `website_route_rules` preserve React Router deep links below `/customer-portal`.
- A regex website redirect preserves previously printed `/verify-card/:token` membership QR links.
- `VITE_PORTAL_BASE_PATH=/customer-portal` supplies the production router basename, while `VITE_ERPNEXT_BASE_URL` remains empty for same-origin APIs.
- Brand and membership-card assets resolve through the Vite/Frappe asset base instead of assuming a domain-root `/assets` directory.
- This package does not replace the existing `moneygram` app; that app remains authoritative for portal APIs, DocTypes and financial workflows.

The portal is partway through conversion from the original demonstration UI to live ERPNext-backed modules.

| Area | Status | Data source |
| --- | --- | --- |
| Landing page | Complete | Static portal content |
| Dashboard | Live | ERPNext wallet, request, membership and limits records |
| Authentication/session | Live | ERPNext/Frappe |
| Signup provisioning | Live | ERPNext User/Customer/Supplier/Contact/Card |
| Profile and address | Live | ERPNext |
| KYC upload/review | Live | ERPNext custom DocType |
| Membership card | Live | ERPNext custom DocType and generated PDF |
| Forex estimate/request/receipt | Live | Item Price, Warehouse and custom request DocType |
| Money-transfer request/receipt | Live | Item, Warehouse and custom request DocType |
| Wallet | Live core ledger and request workflow | ERPNext custom DocTypes, Journal Entry and Loyalty Program |
| Transactions/history | Live for Forex/Transfer requests | ERPNext custom request DocTypes |
| Statements | Live | Forex/Transfer request DocTypes and posted wallet ledger |
| Limits/compliance usage | Live policy catalogue and usage ledger | RBF 2026 guideline and ERPNext custom DocType |
| Notifications | Live | ERPNext Notification Log and custom status hooks |
| Gift Your Loved Ones | Frontend prototype | Sample catalogue, stores, checkout and browser-generated gift card |
| Activity analytics | Prototype only | Local mock state |
| Branches/appointments | Prototype only | Static/demo workflow |
| Help & Support | Live | ERPNext Company and Issue |
| Settings | Prototype only | Static/demo workflow |
| Password reset | Prototype only | No live reset delivery |
| Beneficiaries and detailed histories | Placeholder routes | No backend implementation |

The most recently implemented module is the `Gift Your Loved Ones` prototype. It demonstrates catalogue browsing, pickup/delivery, wrapping, sample payment selection and a downloadable/printable gift card without touching live ERPNext financial records. Notifications, Help & Support, the dashboard and My Limits remain live; My Limits does not infer regulatory usage from legacy free-text request purposes.

Last verification performed during membership work:

- Frontend production build passed.
- Existing money utility test passed as part of the available test suite.
- Python syntax and whitespace checks passed.
- Transactional signup rollback test confirmed matching Customer/Supplier IDs and Contact links.
- Membership approval was tested both for missing-evidence rejection and full activation.
- Generated membership PDF was tested successfully.
- Synthetic test records were rolled back.
- On 29 October 2026 the revised DocType was migrated on `mmel.local`; the original five cards were backfilled with unique numbers and 32-character verification tokens. A later sixth card was also present when all records were expanded to the unique 16-digit format.
- The live Abhi card passed QR SVG generation, public verification and two-sided PDF generation (689,685 bytes), after which the `frappe-mmel` web and worker process groups were restarted.
- The revised 16-digit card PDF was rendered and visually checked after deployment: both pages are 243.84 x 153.12 points (approximately 86 x 54 mm), the logo no longer tiles, content does not overlap, and Company phone/email/website render on the back. Web and worker processes were restarted afterward.

Receipt verification performed on 29 October 2026:

- Frontend production build and existing Vitest suite passed.
- Both modified Frappe modules passed local and server-side Python syntax checks.
- PDF generation succeeded for an existing customer-owned forex request and money-transfer request.
- A different portal customer was denied access to both receipts with `PermissionError`.
- Guest HTTP access to both receipt methods was denied.
- The two API files were deployed to the office ERPNext server and only the `frappe-mmel` web/worker process groups were restarted.

Transactions verification performed on 29 October 2026:

- Frontend production build, existing Vitest suite, Python compilation and diff checks passed.
- The new API was deployed without a schema migration and the `frappe-mmel` web/worker groups were restarted.
- A live portal customer received the expected three owned Forex/Transfer records with correct summary and filtering.
- Both Forex and Money Transfer detail retrieval succeeded for the owning customer.
- A different portal customer was denied access with `PermissionError`; guest HTTP access was also denied.

Statements verification performed on 29 October 2026:

- Frontend production build, Vitest suite, Python compilation and whitespace checks passed.
- The new API was deployed to the active office-server Moneygram package without a schema migration; cache was cleared and the `frappe-mmel` web/worker process groups were restarted.
- One active customer returned five consolidated records: two Forex requests, one Money Transfer request and two posted wallet entries.
- Consolidated PDF generation succeeded (17,182 bytes) and CSV generation succeeded (760 bytes); all four statement-type filters returned the expected counts.
- Guest access was denied with `AuthenticationError`, and a period longer than 366 days was rejected with `ValidationError`.

My Limits verification performed on 29 October 2026:

- The attached RBF guideline was extracted in full and the relevant personal-remittance, card, education, medical, non-resident and travel tables were visually checked against the rendered source pages.
- Frontend production build, Vitest suite, Python compilation, DocType JSON validation and whitespace checks passed.
- The new API and `Customer Exchange Control Usage` DocType were deployed to the verified office ERPNext server and `mmel.local` migrated successfully.
- The `frappe-mmel` web and worker groups were restarted. Guest HTTP access was denied with HTTP 403.
- An authenticated website customer received 17 policy rules, an isolated usage count, and the correct October 2026 monthly period key. No synthetic compliance record was retained.

Dashboard verification performed on 29 October 2026:

- Frontend production build, Vitest suite, Python compilation and whitespace checks passed.
- The new read-only dashboard API was deployed to the verified office ERPNext server without a schema migration; cache was cleared and the `frappe-mmel` web/worker groups were restarted.
- Guest HTTP access was denied with HTTP 403.
- An authenticated website customer received six activity buckets, three owned recent requests, FJD wallet context, membership status, 17 limit rules and matching server-resolved customer ownership.

Help & Support verification performed on 29 October 2026:

- Frontend production build, Vitest suite, Python compilation and whitespace checks passed.
- The new API was deployed to the verified office ERPNext server without a schema migration; cache was cleared and the `frappe-mmel` web/worker groups were restarted.
- Guest HTTP access was denied with HTTP 403.
- An authenticated website customer received the configured Company email/telephone and valid Issue priorities.
- Rollback-safe Issue creation confirmed the standard ERPNext Issue workflow, and no synthetic support Issue was retained.

Notifications verification performed on 29 October 2026:

- Frontend production build, Vitest suite, Python compilation and whitespace checks passed.
- The API and five status-hook controllers were deployed through the verified public SSH endpoint without a schema migration; cache was cleared and the `frappe-mmel` web/worker process groups were restarted.
- Rollback-safe smoke tests confirmed creation, listing, customer-safe routing, unread counts, individual read state and Mark all as read.
- A second portal customer could neither see nor mark another customer's alert, and Guest access was rejected with `AuthenticationError`.
- A real Forex request status transition created the expected linked alert; both the temporary status change and synthetic Notification Log entry were rolled back.

Gift prototype verification performed on 29 October 2026:

- Frontend production build and Vitest suite passed; the gift checkout test increased the suite to three passing tests across two files.
- Browser QA confirmed the responsive catalogue, category/subcategory controls, bag totals, Nadi store pickup, MoneyGram Inbound selection, gift wrapping and sample order confirmation.
- The branded gift card rendered correctly at the mobile viewport and downloaded successfully as an SVG containing the exact supplied logo.
- No ERPNext schema, API, customer record, wallet balance or payment state was changed.

Frappe application packaging verification performed on 30 October 2026:

- `npm run build:frappe` generated the app-scoped production assets and synchronised the Frappe website entry page successfully.
- The generated page references only `/assets/mmel_customer_portal/customer_portal/` assets, and the generated bundle contains no hardcoded public ERPNext hostname.
- The normal frontend production build and all three Vitest tests passed.
- The new Frappe package/controller Python files and the adjusted membership API passed syntax checks; hook metadata and route rules loaded successfully.
- `git diff --check` passed.
- The app was not installed or smoke-tested on `mmel.local` during this local packaging change.
- The first remote `bench get-app` attempt exposed a PEP 517 editable-build issue: `setup.py` imported the package before it was installed, and the hyphenated project name caused Bench to select a hyphenated app directory. Packaging metadata now uses the underscore app name consistently and a self-contained version value.
- The next remote attempt exposed floating frontend dependency risk: Yarn resolved jsdom 30, which requires Node 24.15.0 while the Bench server runs Node 24.11.1. All direct frontend dependencies are now exactly pinned, with jsdom 29.1.1 retained for Node 24.11 compatibility.

## 4. Pending tasks

### Functional modules

- Connect wallet hold/capture/release to Forex and Money Transfer operator completion after settlement rules are confirmed.
- Add controlled wallet reversal/refund actions and reconciliation reporting.
- Configure the Loyalty Program earning/redemption rules and assign eligible customers.
- Extend unified history only when an authoritative wallet ledger or additional validated operational linkage is approved.
- Implement forex booking history/detail and customer cancellation rules.
- Implement money-transfer beneficiaries, request history/detail and provider status mapping.
- Define retention and archival rules for generated statements; statement files are currently generated on demand and are not stored as separate records.
- Link Forex and Money Transfer operator completion to the appropriate exchange-control rule and automatically create/update compliance-usage records once the business mapping is approved.
- Implement notification preferences and approved email/SMS delivery; the in-app ERPNext inbox is live.
- Replace the sample gift catalogue and stores with the customer's approved e-commerce product, inventory, location and delivery APIs.
- Design the ERPNext/e-commerce Gift Order lifecycle, customer ownership, inventory reservation, fulfilment, cancellation/refund and reconciliation rules.
- Integrate each approved gift payment method independently; MH Wallet payment must use an operator-approved/accounted hold-capture-release flow and must not directly mutate balances in the browser.
- Move gift-card generation to an ownership-checked server endpoint after an authoritative order is accepted.
- Implement branch details, service availability and appointments.
- Add approved support-ticket attachments and customer/operator threaded communication; core Issue creation and status history are live.
- Implement customer settings and security controls.
- Implement real forgot-password email delivery and time-limited reset flow.

### Production readiness

- Install and smoke-test the new `mmel_customer_portal` package on `mmel.local`; the package has been built locally but has not been deployed in this change.
- Confirm production cache headers and automate the documented frontend/Frappe build and deployment sequence.
- Add role permissions for all custom DocTypes to fixtures or migrations and verify least privilege.
- Add idempotency keys and duplicate-submission protection to financial request creation.
- Add correlation IDs and stable customer-safe API error codes.
- Confirm CORS, cookie, CSRF, session timeout and reverse-proxy limits for production.
- Add malware scanning, type validation, retention and access controls for uploaded KYC files.
- Add audit/history reporting for operator approvals and transaction status changes.
- Complete accessibility, browser, responsive, threat-model, penetration and compliance testing.
- Add automated tests for every live API and frontend service, including authorization isolation.
- Confirm the requested public deployment/URL strategy for the standalone customer portal.

## 5. Outstanding bugs and risks

No confirmed blocking defect was left open in the most recently tested membership flow. The following known gaps and risks remain:

- Large customer-photo uploads are compressed in the browser, but large non-image KYC files can still hit Frappe or proxy request limits. Server-side size validation and a documented upload limit are still needed.
- The frontend has minimal automated coverage. Regressions in authentication, KYC, membership, forex and transfer workflows may not be caught automatically.
- The production build reports a large JavaScript chunk warning. Route-level code splitting has not been implemented.
- `src/app/pages.tsx` is large and contains many unrelated modules, increasing regression and merge-conflict risk.
- `src/services/api.ts` and `src/data/mock.ts` remain active for unfinished pages; developers must not mistake sample balances or transactions for authoritative data.
- The local Vite server binds to `127.0.0.1`, so it is intentionally not reachable from another device. Public/LAN access requires an approved deployment or an explicit development-host change.
- The frontend depends on the existing server method `moneygram.moneygram.api.allow_login.get_csrf_token`; its implementation is not included in this repository snapshot.
- Remote deployment has been manual. Local ERPNext files and server files can drift unless a repeatable Git-based deployment process is adopted.
- TypeScript build metadata files are currently modified in the working tree; avoid treating generated metadata as meaningful source changes.
- Gift product photographs currently use remote sample image URLs. The live e-commerce feed must supply approved durable product media and availability metadata.

## 6. Important technical decisions

### ERPNext is authoritative

Rates, customer identity, KYC status, card status, branch availability and request status are determined on the server. The browser must not activate a card, complete a transaction, approve evidence, or invent a provider reference.

### The portal submits requests, not completed financial transactions

Forex and money-transfer portal actions create reviewable request DocTypes. Authorised operators complete the actual operational transaction in ERPNext after checks and customer attendance at the selected branch.

### One person has matching Customer and Supplier identities

A member can buy or sell foreign currency. Signup therefore creates both parties with the same ID. The Contact links to both records, and `Customer Membership Card` validates that the IDs match.

### Membership approval is deliberately two-stage

Operators first verify individual KYC evidence, then approve the profile, then approve the card. The card becomes `Active` only after both review states are `Approved`. Uploading a new customer photo resets profile/card review to pending.

### Cookie session and CSRF, not frontend tokens

The frontend uses Frappe session cookies with `credentials: include` and obtains a CSRF token for mutating requests. Do not add bearer tokens to local storage.

### Same-origin production API

`VITE_ERPNEXT_BASE_URL` may be used when explicitly required, but production is designed to call same-origin `/api` paths. Local Vite proxying is development-only.

### Money values and rates

Decimal-safe calculations and explicit currencies are required. The final rate/amount must always be recalculated or validated by ERPNext. Fiji-dollar customer totals are displayed as `F$` where requested.

### Uploaded evidence belongs in a dedicated DocType

`Customer Portal KYC Document` replaced assumptions about unrelated/nonexistent evidence DocTypes. Review state and audit data are stored with each uploaded item.

### Exact brand assets must be reused

Do not recreate the logo with editable text, because that previously introduced spelling changes. Use the supplied assets in `public/assets` and the card source images in the project root.

## 7. Recently modified files

The current working tree contains uncommitted application work. Do not discard or overwrite it.

### Frontend and configuration

- `.env.example` — public ERPNext base URL/session configuration example.
- `README.md` — local server/proxy information; status text remains partly stale.
- `vite.config.ts` — local `/api` proxy to the public ERPNext URL at `https://moneygram.advtinni.com`.
- `src/App.tsx` — public landing route, protected routes and module routing.
- `src/app/AppShell.tsx` — navigation and branding changes.
- `src/app/LandingPage.tsx` — new public landing page.
- `src/app/MembershipCardPage.tsx` — restored reference card design, dynamic 16-digit number, photo, QR, Company contact details and two-sided actions.
- `src/app/VerifyCardPage.tsx` — public minimal card-status verification reached from the QR.
- `src/app/pages.tsx` — live forex, transfer, profile/KYC and membership UI plus responsive auth updates.
- `src/stores/session.ts` — live session restoration and authentication state.
- `src/services/auth.ts` — common Frappe request, CSRF, login and signup client.
- `src/services/forex.ts` — live forex client.
- `src/services/moneyTransfer.ts` — live money-transfer client.
- `src/services/profile.ts` — live profile/KYC client and image compression.
- `src/services/membership.ts` — live membership/PDF client and image compression.
- `src/services/receipt.ts` — shared authenticated browser download and print-window handling for request PDFs.
- `src/services/transactions.ts` — typed unified transaction history/detail client.
- `src/services/statements.ts` — typed statement preview and download/print client.
- `src/services/limits.ts` — typed RBF policy catalogue and customer usage client.
- `src/services/dashboard.ts` — typed customer dashboard snapshot client.
- `src/services/support.ts` — typed Company contact and ERPNext Issue client.
- `src/services/notifications.ts` — typed ERPNext Notification Log inbox, unread-count and read-state client.
- `src/app/TransactionsPage.tsx` — live history, filters, pagination, CSV export, details and receipt actions.
- `src/app/StatementsPage.tsx` — live statement selection, period controls, preview, PDF/CSV download and print actions.
- `src/app/LimitsPage.tsx` — live rule catalogue, category filters, ledger-backed usage and documentary requirements.
- `src/app/DashboardPage.tsx` — live overview, current request, quick actions, activity charts and recent requests.
- `src/app/SupportPage.tsx` — live Company contacts, ERPNext Issue creation, customer ticket history and FAQ content.
- `src/app/NotificationsPage.tsx` — live All/Unread inbox with refresh and read-state actions.
- `src/app/GiftsPage.tsx` — sample gift catalogue, bag, checkout and shareable gift-card experience.
- `src/app/GiftsPage.test.tsx` — catalogue-to-sample-order interaction test.
- `src/data/gifts.ts` — typed sample categories, products, stores and payment choices for the gift prototype.
- `src/styles.css` — landing, mobile auth, live-module, receipt and membership styles.
- `public/assets/membership-card-front-template.png`, `public/assets/membership-card-back-template.png` — restored membership artwork derived from the supplied reference card.
- `src/components/DemoBanner.tsx` — removed.
- `tsconfig.app.tsbuildinfo`, `tsconfig.node.tsbuildinfo` — generated build metadata.
- `package.json`, `.env.frappe`, `vite.config.ts`, `scripts/sync-frappe-page.mjs` — Frappe-specific build command, router/asset base and generated-page synchronisation.
- `setup.py`, `pyproject.toml`, `MANIFEST.in`, `requirements.txt` — installable Frappe/Python package metadata.
- `mmel_customer_portal/` — app hooks, dependency declaration, website route controller, generated SPA page and app-scoped production assets.

### ERPNext/Frappe additions

- `erpnext/moneygram/moneygram/api/customer_portal_auth.py`
- `erpnext/moneygram/moneygram/api/customer_portal_profile.py`
- `erpnext/moneygram/moneygram/api/customer_portal_membership.py` — live card payload, Company contact lookup and exact-size two-sided image-based PDF generation.
- `erpnext/moneygram/moneygram/api/customer_portal_forex.py` — live forex request APIs and ownership-checked PDF receipt generation.
- `erpnext/moneygram/moneygram/api/customer_portal_money_transfer.py` — live transfer request APIs and ownership-checked PDF receipt generation.
- `erpnext/moneygram/moneygram/api/customer_portal_transactions.py` — unified customer-owned Forex/Transfer history and detail API.
- `erpnext/moneygram/moneygram/api/customer_portal_statements.py` — ownership-checked consolidated/Forex/Transfer/wallet statement generation.
- `erpnext/moneygram/moneygram/api/customer_portal_limits.py` — RBF 2026 delegated-limit catalogue and customer-isolated usage summary.
- `erpnext/moneygram/moneygram/api/customer_portal_dashboard.py` — customer-isolated dashboard aggregate.
- `erpnext/moneygram/moneygram/api/customer_portal_support.py` — Company contact lookup and customer-isolated standard Issue creation/history.
- `erpnext/moneygram/moneygram/api/customer_portal_notifications.py` — customer-isolated Notification Log inbox and non-blocking status-alert helpers.
- `erpnext/moneygram/moneygram/doctype/customer_exchange_control_usage/` — operator-controlled compliance usage ledger.
- `erpnext/moneygram/moneygram/doctype/customer_forex_request/`
- `erpnext/moneygram/moneygram/doctype/customer_money_transfer_request/`
- `erpnext/moneygram/moneygram/doctype/customer_portal_kyc_document/`
- `erpnext/moneygram/moneygram/doctype/customer_membership_card/`
- The Forex, Money Transfer, wallet request, KYC document and membership-card Python controllers now emit linked status notifications.
- `erpnext/moneygram/moneygram/public/images/membership-card-*.png` — server-side PDF artwork; the exact logo is mirrored alongside it.

## 8. Instructions for continuing development

### Local frontend workflow

```bash
npm install
cp .env.example .env.local
npm run dev
```

The local URL is `http://127.0.0.1:4173`. The current Vite proxy sends `/api` requests to `https://moneygram.advtinni.com`; switch it back to `http://192.168.101.182:83` only when deliberately developing through the office network.

Before handing off a frontend change:

```bash
npm run build
npm run test
git diff --check
```

### ERPNext development workflow

1. Treat the files under `erpnext/moneygram/` as the local source of truth for portal-specific server changes.
2. Inspect the current server version before editing or copying files; do not overwrite unrelated server work.
3. Verify the SSH destination before any mutation. Use `moneygram.advtinni.com:22422` externally or `192.168.101.182:22` on the office network; never assume that a reachable host is the correct ERPNext server.
4. Copy only reviewed files into the existing `moneygram` app.
5. For DocType/schema changes, run the site migration.
6. Clear cache and restart processes when Python/JS metadata changes require it.
7. Test with a rollback-safe or disposable record and remove synthetic data.

Typical server commands, run from the bench directory after the files are deployed:

```bash
bench --site mmel.local migrate
bench --site mmel.local clear-cache
bench restart
```

Do not run destructive Git, database or bench commands without first resolving their exact target and obtaining authorization.

### Adding the next live module

1. Identify the authoritative ERPNext DocTypes and business rules with the operator workflow owner.
2. Add server-side whitelisted APIs with authentication, customer isolation, validation and audit fields.
3. Add or modify DocTypes locally and include their Python, JSON, JavaScript and `__init__.py` files.
4. Create a typed client in `src/services/`; reuse `frappeRequest`, `formBody` and the CSRF/session conventions in `auth.ts`.
5. Replace only the target module's mock UI. Keep unfinished modules clearly separated from live financial data.
6. Handle loading, empty, error, retry and duplicate-submit states.
7. Test unauthorized access, cross-customer access, invalid states, retries and the normal operator lifecycle.
8. Build and test locally, deploy narrowly, migrate if needed, and perform a production smoke test.

### Membership approval checklist

When an operator receives “Verify the following KYC evidence before approving the profile,” verify that the customer has separate `Customer Portal KYC Document` records for:

1. An accepted identity type, status `Verified`.
2. `PROOF_OF_ADDRESS`, status `Verified`.
3. `CUSTOMER_PHOTO`, status `Verified`.

After all three are verified, use **Approve Profile** on the membership card, followed by **Approve Card**. Uploading or visually inspecting a photo alone does not satisfy identity or address requirements.

### Security and data handling

- Never commit passwords, SSH keys, API secrets, cookies, CSRF tokens, customer documents or real customer data.
- Do not log full KYC payloads or document contents.
- Keep all approval, eligibility, rate and transaction decisions server-side.
- Preserve customer-level record isolation in every list/get/update endpoint.
- Use backend-generated references, idempotency and audit data for financial mutations.
- Back up and confirm recovery options before schema or production-data changes.
