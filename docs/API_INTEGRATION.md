# API integration contract and checklist

The proposed names below describe frontend capabilities unless explicitly marked Live. Map unfinished capabilities to the existing operational backend only after its owners confirm authentication, payloads, error semantics, idempotency, authorisation, audit, and regulatory behaviour.

## Implemented portal integrations

The current portal already uses authenticated Frappe APIs for signup/session, profile/KYC, membership cards, forex requests, money-transfer requests, request receipts, unified customer transaction history, the FJD wallet, statements, My Limits, the dashboard, notifications and Help & Support. Unified Forex/Transfer history remains separate from the wallet ledger and legacy imported transaction tables are not included.

The installable `mmel_customer_portal` Frappe app serves the React application at `/customer-portal`. Production API calls intentionally use relative, same-origin `/api/method/...` URLs so the existing Frappe session cookie and CSRF flow remain on the ERPNext origin. `VITE_ERPNEXT_BASE_URL` is only an optional development override and must remain empty in the Frappe build.

### Dashboard

- Live: `customer_portal_dashboard.get_dashboard` returns one customer-isolated snapshot containing wallet balances, request counts, membership/profile-review status, compliance-ledger counts, a current open request, five recent requests and six monthly activity buckets.
- Request chart values are submitted Forex and Money Transfer request amounts. Wallet chart values are posted `Customer Wallet Transaction` credits and debits. They are intentionally labelled and kept separate.
- The endpoint accepts no customer identifier; identity is resolved from the authenticated Frappe session.

## Adapter principles

1. Use secure, backend-managed customer sessions; do not store bearer tokens in local storage.
2. Treat all amounts as decimal strings with explicit ISO currency codes.
3. Require a server-issued transaction or booking reference for every financial mutation.
4. Require idempotency keys for creation, funding, capture, refund, and reversal operations.
5. Treat balances, rates, charges, limits, eligibility, KYC, AML, sanctions screening, and provider statuses as server-authoritative.
6. Return structured error codes safe for customers, plus a correlation ID for support.
7. Use short-lived signed references for card QR verification. Never encode identity documents, addresses, or sensitive personal information.

## Proposed logical resources

### Authentication

- `startPasswordSession`
- `requestMobileOtp`
- `verifyMobileOtp`
- `requestPasswordReset`
- `endSession`
- `getSessionStatus`
- `startMfaChallenge`
- `verifyMfaChallenge`

### Customer and KYC

- `getCustomerProfile`
- `updateCustomerProfile`
- `getKycStatus`
- `getDocumentRequirements`
- `createSecureUpload`
- `submitKycDocument`
- `getKycReviewHistory`

### Membership

- `getMembershipCard`
- `getCardVerificationToken`
- `downloadMembershipCard`
- `reportCardLost`
- `requestReplacementCard`

### Foreign exchange

- `getSupportedCurrencies`
- `getForexQuote`
- `validateForexEligibility`
- `createForexBooking`
- `getForexBookings`
- `getForexBookingDetails`
- `cancelForexBooking`

### Money transfer

- `getTransferQuote`
- `getBeneficiaries`
- `createBeneficiary`
- `updateBeneficiary`
- `deactivateBeneficiary`
- `validateTransferEligibility`
- `createTransferRequest`
- `getTransferStatus`

Provider references must be absent until the authorised provider returns them.

### Wallet

Implemented in `customer_portal_wallet.py`:

- `get_wallet`: authoritative available/held/total balances, recent ledger entries and native ERPNext loyalty summary.
- `list_transactions`: paginated customer-owned wallet ledger.
- `list_requests`: customer-owned funding and withdrawal requests.
- `create_request`: creates an operator-reviewable funding or withdrawal request; it never changes a balance.
- `cancel_request`: cancels an owned Pending request.
- `approve_request` / `reject_request`: permission-checked operator actions. Approval submits a balanced Journal Entry and atomically posts the wallet transaction.
- `download_statement`: ownership-checked PDF statement of posted ledger entries.
- `download_request_receipt`: ownership-checked wallet request PDF.

The live schema uses `Customer Wallet Settings`, `Customer Wallet`, `Customer Wallet Request`, and immutable `Customer Wallet Transaction` records. Customer cash is posted against dedicated Balance Sheet clearing and liability accounts. Loyalty points are read from ERPNext's standard Loyalty Program and Loyalty Point Entry DocTypes and never merged into cash balance. A Loyalty Program is not yet configured on the current site.

### Compliance and limits

- Live: `customer_portal_limits.get_my_limits` returns the RBF policy catalogue effective 1 January 2026 and customer-isolated completed/pending totals from `Customer Exchange Control Usage`.
- The server returns rule code, policy page, period/basis, delegated FJD limit, requirements, conditions and the current ledger-backed usage. Per-trip, per-invoice and per-application rules do not expose a misleading combined available balance.
- Usage must be recorded by an operator against a customer, portal user, rule code, allowance-period key and optional source record. Legacy request purposes are not inferred.
- `validateTransactionEligibility`
- `getRegulatoryUsageHistory`
- `getComplianceDecisionExplanation`

Responses should include rule ID, rule version, effective date, applied exchange rate, proposed consumption, pending reservations, outcome, and required next steps.

### Activity, statements, and notifications

- `getTransactionHistory`
- `getTransactionDetails`
- Live: `customer_portal_statements.get_preview` for consolidated, Forex, Money Transfer and posted-wallet record counts/totals over a period of up to 366 days.
- Live: `customer_portal_statements.download_statement` for authenticated, ownership-checked PDF or CSV output.
- Statements are generated on demand; separate storage, signatures, retention and asynchronous status tracking are not yet implemented.
- Live: `customer_portal_notifications.get_notifications` returns the authenticated user's standard ERPNext `Notification Log` entries with customer-safe portal routes.
- Live: `customer_portal_notifications.get_unread_count` returns the exact session user's unread count for navigation badges.
- Live: `customer_portal_notifications.mark_read` and `mark_all_read` update only entries whose `for_user` matches the authenticated session user.
- Status changes in Forex, Money Transfer, wallet request, KYC document and membership review records create non-blocking ERPNext alerts for the linked portal user.
- `updateNotificationPreferences`

### Branches and support

- `getBranches`
- `getBranchServices`
- `getAvailableAppointmentSlots`
- `createAppointment`
- Live: `customer_portal_support.get_support_home` returns the default ERPNext Company's configured email/telephone, valid Issue priorities and the authenticated customer's Issue history.
- Live: `customer_portal_support.create_ticket` creates a standard ERPNext `Issue`, linked server-side to both the authenticated portal user email and resolved Customer. It accepts subject, description, priority and an optional request/card reference.
- Ticket history is isolated by both Customer and `raised_by`; the browser cannot select another customer identifier.
- Issue attachments and threaded customer replies are not yet exposed in the portal.

### Gifts and e-commerce

The current `Gift Your Loved Ones` page is a sample-data frontend prototype. The future connector should provide:

- `getGiftCategories` and `getGiftProducts` with authoritative category, subcategory, image, description, price, currency, stock and store availability.
- `getGiftStores` and delivery-zone/fee/date availability.
- A server-side cart/quote with inventory reservation, tax, delivery and wrapping charges.
- `createGiftOrder` with an idempotency key and authenticated Customer ownership.
- Separate authorised payment flows for MH Wallet, M-PAiSA/M-Pesa, MyCash, card, bank transfer and eligible MoneyGram inbound transactions.
- Provider callbacks, payment reconciliation, fulfilment status, cancellation/refund rules and customer notifications.
- A server-generated, customer-owned printable/downloadable gift card after order acceptance.

The prototype must not debit the live wallet or represent its browser-generated sample reference as an ERPNext/e-commerce order.

## Integration readiness checklist

- [ ] Confirm backend base URLs by environment.
- [ ] Confirm session and MFA design with security owners.
- [ ] Document customer-level authorisation and data isolation.
- [ ] Confirm CSRF, CORS, cookie, timeout, and refresh behaviour.
- [ ] Obtain OpenAPI or equivalent schemas for approved capabilities.
- [ ] Confirm decimal precision, currency rounding, and server formatting rules.
- [ ] Confirm idempotency scope, expiry, conflict behaviour, and retry safety.
- [ ] Confirm booking and transfer state machines.
- [ ] Connect wallet holds/capture/release to approved Forex and Money Transfer completion workflows after the operational settlement rules are confirmed.
- [ ] Configure the ERPNext Loyalty Program earning rate, redemption factor, expiry and customer assignment.
- [ ] Confirm KYC, AML, sanctions, source-of-funds, and enhanced-due-diligence integrations.
- [ ] Approve automatic mapping from operational Forex/Money Transfer completion to the RBF rule codes and compliance-usage ledger.
- [ ] Confirm provider reference masking and customer-visible status mapping.
- [ ] Confirm secure document upload, malware scanning, retention, and access rules.
- [ ] Confirm statement signatures, retention/archival and whether generated files require stored records or asynchronous status tracking.
- [ ] Confirm notification templates and approved email/SMS providers.
- [ ] Approve the e-commerce catalogue, inventory, store, delivery, order and payment-provider contracts for `Gift Your Loved Ones`.
- [ ] Add audit correlation IDs and customer-safe error mappings.
- [ ] Complete accessibility, responsive, threat-model, penetration, and financial-control testing.
