# Master Implementation Plan — 1 Week to MVP

**Timeline:** Week of [DATE] → Ready for first customer presentation

---

## Phase 1: Core Dispatch Loop (Days 1-2)
### Pages & Components Needed

**Customer App:**
- `src/app/customer/dashboard/page.tsx` — Home, active requests, map
- `src/app/customer/request/new/page.tsx` — Create service request (location, type, description)
- `src/app/customer/request/[id]/page.tsx` — Track request status + technician location (WebSocket)
- `src/app/customer/history/page.tsx` — Past requests, ratings, invoices

**Technician App:**
- `src/app/tech/dashboard/page.tsx` — Available jobs, location sharing
- `src/app/tech/dispatch/[id]/page.tsx` — Accept/reject dispatch, ETA, route
- `src/app/tech/active/page.tsx` — En-route, arrived, in-progress states
- `src/app/tech/earnings/page.tsx` — Daily/weekly earnings, wallet

**Shared:**
- `src/components/Map.tsx` — Leaflet map with technician markers
- `src/components/DispatchNotification.tsx` — Real-time dispatch popup (Socket.IO)
- `src/lib/dispatch-service.ts` — Matching algorithm, WebSocket handlers

**API Routes:**
- `src/app/api/dispatch/create/route.ts` — POST create service request
- `src/app/api/dispatch/[id]/accept/route.ts` — Technician accepts dispatch
- `src/app/api/dispatch/[id]/reject/route.ts` — Technician rejects dispatch
- `src/app/api/dispatch/[id]/status/route.ts` — WebSocket endpoint for status updates
- `src/app/api/tech/location/route.ts` — POST technician location (background)

**Database Seed Data:**
- `prisma/seed.ts` — Add demo technicians, customers, pricing rules, service areas

---

## Phase 2: Payment Flows (Days 3)
### Pages & Components

**Stripe Subscriptions:**
- `src/app/api/stripe/subscription-checkout/route.ts` — Annual €30 plan
- `src/app/customer/subscription/page.tsx` — Show current subscription, upgrade option

**Thronos Crypto Payments:**
- `src/app/api/thronos/payment/route.ts` — Lock escrow, call attestation
- `src/app/customer/request/[id]/pay/page.tsx` — Payment method choice (Card/Crypto)
- `src/lib/payment-service.ts` — Payment orchestration (Stripe → Thronos)

**Payment Confirmation:**
- `src/app/api/stripe/webhook/route.ts` — Already exists, verify works
- Mark request as COMPLETED when payment confirmed
- Send funds to technician wallet

---

## Phase 3: Tenant Dashboard (Days 3-4)
### Pages

**Tenant Admin:**
- `src/app/t/[slug]/admin/page.tsx` — Overview (team, requests, earnings)
- `src/app/t/[slug]/admin/team/page.tsx` — Technician management, onboarding
- `src/app/t/[slug]/admin/team/[id]/page.tsx` — Individual tech stats, payouts
- `src/app/t/[slug]/admin/requests/page.tsx` — All requests (filter by status, date)
- `src/app/t/[slug]/admin/analytics/page.tsx` — Charts (volume, revenue, ratings)
- `src/app/t/[slug]/admin/payouts/page.tsx` — Mass payout to technicians
- `src/app/t/[slug]/admin/settings/page.tsx` — Service areas, pricing rules

**API Routes:**
- `src/app/api/tenant/[slug]/stats/route.ts` — Daily/weekly KPIs
- `src/app/api/tenant/[slug]/payout/route.ts` — Trigger rewards distribution
- `src/app/api/tenant/[slug]/settings/route.ts` — Update service areas, pricing

---

## Phase 4: Admin Controls (Days 4-5)
### Super Admin Features

**Pricing Rules Management:**
- `src/app/admin/pricing/page.tsx` — Create/edit pricing per service type
- `src/app/api/admin/pricing/route.ts` — CRUD pricing rules

**Service Areas:**
- `src/app/admin/service-areas/page.tsx` — Map view, create coverage zones
- `src/app/api/admin/service-areas/route.ts` — CRUD areas

**Rewards Pool:**
- `src/app/admin/rewards/page.tsx` — Monitor AI pool, distribution history
- `src/app/api/admin/rewards/distribute/route.ts` — Trigger distribution

**Tenant Management:**
- Already exists (`/admin/tenants`), verify it works

---

## Phase 5: Analytics & Monitoring (Day 5)
### Dashboards

**Customer Dashboard:**
- Request completion rate
- Avg response time
- Total spent
- Favorite technicians

**Technician Dashboard:**
- Jobs completed this week
- Earnings
- Rating trend
- Most common service type

**Super Admin Dashboard:**
- Already exists, add:
  - Daily transaction volume
  - Revenue by tenant
  - Technician online count
  - P2P order status

**API:**
- `src/app/api/analytics/dashboard/route.ts` — Aggregated metrics

---

## Phase 6: Deploy & Polish (Day 6-7)
### Pre-Launch Checklist

- [ ] Load test: 1000 req/sec, 100 concurrent users
- [ ] Real-time: 500 WebSocket connections
- [ ] Payment flows: Test Stripe + Thronos end-to-end
- [ ] Seed production data (demo tenant, technicians, customers)
- [ ] Stripe production keys configured
- [ ] Thronos contracts deployed (testnet minimum)
- [ ] Redis: Cache warming scripts
- [ ] Error handling: Sentry logging
- [ ] Email: Confirmation emails for sign-up, dispatch, payment
- [ ] Rate limiting: API endpoints rate-limited
- [ ] Security: CSRF tokens, input validation
- [ ] Monitoring: Alerts for failed payments, offline technicians
- [ ] Documentation: User guides (tech, customer, admin)
- [ ] Deploy to Railway production

---

## File Count Summary

**Pages:** ~20
**API Routes:** ~15
**Components:** ~10
**Lib functions:** ~8
**Total new files:** ~53

---

## Technology Stack

- **Frontend:** Next.js 14, React, TailwindCSS, Leaflet (maps)
- **Backend:** Next.js API routes, Prisma ORM
- **Real-time:** Socket.IO + Redis adapter
- **Payments:** Stripe API, Thronos Gateway
- **Database:** PostgreSQL (Neon)
- **Cache:** Redis (Railway)
- **Hosting:** Railway
- **Monitoring:** Built-in + Sentry (optional)

---

## Success Criteria

✅ Customer can:
- Sign up
- Request service (with location)
- Pay (Stripe or Thronos)
- Rate technician
- Subscribe for discount

✅ Technician can:
- Sign up
- See available jobs
- Accept dispatch
- Update location (real-time)
- Get paid
- Track earnings

✅ Tenant can:
- Manage team
- View all requests
- See analytics
- Trigger payouts

✅ Admin can:
- Manage all above
- Create pricing rules
- Monitor platform health
- Distribute rewards

---

## Daily Breakdown

**Day 1 (Mon):** Technician + Customer app basic pages
**Day 2 (Tue):** Dispatch matching + WebSocket real-time
**Day 3 (Wed):** Stripe subscription checkout
**Day 4 (Thu):** Thronos payment flow
**Day 5 (Fri):** Tenant dashboard complete
**Day 6 (Sat):** Admin controls + analytics
**Day 7 (Sun):** Testing, deploy, documentation

---

## Notes for Implementation

- Reuse existing Prisma models (no schema changes needed)
- Use existing auth (NextAuth) — just add role-based access
- Socket.IO already integrated with Redis adapter
- Pricing calculation already built (`src/lib/pricing.ts`)
- Location caching already built (`src/lib/location-cache.ts`)
- Thronos integration already built (`src/lib/thronos-api.ts`)

**Focus:** Build UI + API routes. Core logic already exists.
