# API integration contract and checklist

The names below describe frontend capabilities. They are **not confirmed production routes**. Map them to the existing operational backend only after its owners confirm authentication, payloads, error semantics, idempotency, authorisation, audit, and regulatory behaviour.

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

- `getWalletEligibility`
- `getWalletBalance`
- `getWalletTransactions`
- `createWalletFundingRequest`
- `reserveWalletFunds`
- `captureWalletReservation`
- `releaseWalletReservation`
- `requestWalletRefund`
- `getWalletStatement`

Wallet availability depends on confirmed regulatory and licensing approval. Frontend state must never directly credit or debit a balance.

### Compliance and limits

- `getApplicableLimits`
- `getLimitUsage`
- `validateTransactionEligibility`
- `getRegulatoryUsageHistory`
- `getComplianceDecisionExplanation`

Responses should include rule ID, rule version, effective date, applied exchange rate, proposed consumption, pending reservations, outcome, and required next steps.

### Activity, statements, and notifications

- `getTransactionHistory`
- `getTransactionDetails`
- `generateStatement`
- `getStatementStatus`
- `downloadStatement`
- `getNotifications`
- `markNotificationRead`
- `updateNotificationPreferences`

### Branches and support

- `getBranches`
- `getBranchServices`
- `getAvailableAppointmentSlots`
- `createAppointment`
- `createSupportTicket`
- `getSupportTickets`
- `addSupportTicketAttachment`

## Integration readiness checklist

- [ ] Confirm backend base URLs by environment.
- [ ] Confirm session and MFA design with security owners.
- [ ] Document customer-level authorisation and data isolation.
- [ ] Confirm CSRF, CORS, cookie, timeout, and refresh behaviour.
- [ ] Obtain OpenAPI or equivalent schemas for approved capabilities.
- [ ] Confirm decimal precision, currency rounding, and server formatting rules.
- [ ] Confirm idempotency scope, expiry, conflict behaviour, and retry safety.
- [ ] Confirm booking and transfer state machines.
- [ ] Confirm wallet licensing, ledger semantics, reservation, capture, refund, reversal, and reconciliation.
- [ ] Confirm KYC, AML, sanctions, source-of-funds, and enhanced-due-diligence integrations.
- [ ] Confirm RBF rule sources, versions, effective dates, category mapping, and explanations.
- [ ] Confirm provider reference masking and customer-visible status mapping.
- [ ] Confirm secure document upload, malware scanning, retention, and access rules.
- [ ] Confirm statement generation, signatures, retention, and download authorisation.
- [ ] Confirm notification templates and approved email/SMS providers.
- [ ] Add audit correlation IDs and customer-safe error mappings.
- [ ] Complete accessibility, responsive, threat-model, penetration, and financial-control testing.
