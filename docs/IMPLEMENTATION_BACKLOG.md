# Implementation Backlog (Requested Scope)

This backlog focuses on the requested milestones:

- auth and role checks
- admin CRUD UI
- tests for dispatch/import/attestation
- Stripe hold/capture
- optional Thronos escrow
- push notifications
- Flutter app for partners/technicians

## 1) Auth + Role Checks

### Goal
Enforce authenticated access and role-based authorization across API routes and admin pages.

### Deliverables
- Session middleware for protected APIs.
- Role matrix enforced at route level:
  - `customer`: create service requests, view own requests.
  - `technician`: view nearby/assigned jobs, accept assigned jobs only.
  - `admin`: full catalogue + partner + technician management.
- Consistent `401/403` error contract.
- Integration tests for protected routes.

### Suggested order
1. Add shared auth guard utility.
2. Add role guard utility.
3. Apply guards to existing routes.
4. Add tests for happy/forbidden paths.

## 2) Admin CRUD UI

### Goal
Ship complete admin flows for operational data.

### CRUD modules
- Partners
- Technicians
- Service areas
- Battery catalogue
- Tyre catalogue
- Vehicle fitment rules

### Deliverables
- Listing pages with search/filter/pagination.
- Create/Edit forms with schema validation.
- Delete/disable workflows with confirmation.
- Optimistic UX + server-side validation messages.

## 3) Test Coverage: Dispatch / Import / Attestation

### Goal
Protect core business logic with deterministic automated tests.

### Required test suites
- Dispatch ordering by distance/availability rules.
- CSV importer parsing + validation errors.
- Attestation hash determinism and stability.

### Suggested structure
- Unit tests for pure logic (`src/lib/*`).
- Integration tests for route-level workflows.
- Fixtures under `data/templates` and `tests/fixtures`.

## 4) Stripe Hold/Capture

### Goal
Support pre-authorization and capture for completed jobs.

### Deliverables
- PaymentIntent with manual capture.
- Hold at request acceptance (or configurable step).
- Capture on completion.
- Cancel/release hold on timeout/cancel flow.
- Webhook handlers for payment state reconciliation.

### Safety checks
- Idempotency keys for retry-safe operations.
- Audit log rows for payment transitions.

## 5) Optional Thronos Escrow

### Goal
Enable on-chain escrow mode as a feature flag, while keeping Stripe/manual as default.

### Deliverables
- Config flag: `PAYMENT_MODE=stripe|escrow|manual`.
- Escrow create/fund/release/refund flow hooks.
- Off-chain to on-chain reference mapping in DB.
- Failure fallback policy (temporary manual settlement).

## 6) Push Notifications

### Goal
Notify technicians in real time for new assignments and retries.

### Deliverables
- Device token registration endpoint.
- New-dispatch notification event.
- Retry/escalation policy if unacknowledged.
- Delivery status logging.

### Fallback
- SMS/call-center fallback for unreachable technicians.

## 7) Flutter App for Partners/Technicians

### Goal
Provide mobile-first execution for field operations using existing REST APIs.

### Deliverables
- Auth/session integration.
- Job inbox + accept/reject flow.
- Live status updates (en route/on-site/completed).
- Basic profile + availability toggle.
- API contract alignment with `docs/FLUTTER_TECHNICIAN_APP_API.md`.

## Recommended Execution Plan (Phased)

### Phase A (Foundation)
1. Auth + role guards
2. Core tests (dispatch/import/attestation)

### Phase B (Operations)
3. Admin CRUD UI
4. Push notifications

### Phase C (Payments + Mobile)
5. Stripe hold/capture
6. Optional Thronos escrow
7. Flutter app production hardening

## Exit Criteria
- All protected routes enforce auth+role checks.
- Test suites run in CI and cover critical logic.
- Admin users can manage all operational entities end-to-end.
- At least one payment mode (Stripe manual capture) is production-ready.
- Technician mobile workflow can complete request lifecycle.
