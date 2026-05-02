# Production Runbook

## Phase 0 — repo creation

Create a new GitHub repository:

```text
Tsipchain/thronos-roadside-assist
```

Then push this package as the initial commit.

## Phase 1 — infrastructure

Required services:

- PostgreSQL database
- Next.js hosting
- HTTPS domain
- Thronos native EVM RPC
- Thronos attestation endpoint
- Stripe account if card payments are enabled
- Maps provider key
- Push notification VAPID keys

## Phase 2 — environment setup

Use `.env.production.example` as a template. Put real values only in deployment secret storage.

Do not commit `.env`, `.env.local`, or `.env.production`.

Verify:

```bash
npm run chain:verify-env
npm run chain:health
```

Expected `chain:health` result must include a valid `eth_chainId` response.

## Phase 3 — database

```bash
npm install
npx prisma generate
npm run db:push
npm run import:real-data
```

For production, use migrations instead of `db:push` once the schema stabilizes:

```bash
npx prisma migrate dev --name init
npx prisma migrate deploy
```

## Phase 4 — deploy contracts

```bash
npm run chain:compile
npm run chain:deploy:thronos
```

The deploy script writes contract addresses to:

```text
deployments/thronos.json
src/contracts/addresses/thronos.json
```

Copy the deployed addresses into the production secret store.

## Phase 5 — end-to-end validation

Run the app and test:

```bash
npm run build
npm run start
```

Then validate:

- `/api/thronos/health`
- create service request
- accept service request
- complete service request with `attestationMode: "sha256"`
- complete another test with `attestationMode: "both"`
- confirm service record in PostgreSQL
- confirm attestation hash returned
- confirm Thronos EVM tx hash when EVM mode is enabled

## Phase 6 — go-live controls

Before real customers:

- turn on logging and error monitoring
- add rate limits to public endpoints
- force technician password reset
- add admin approval for technicians
- add invoice/receipt integration
- add refund/dispute policy
- add insurance/legal review for roadside service
- add GDPR privacy policy and data retention policy

## Rollback

If Thronos EVM RPC is down, set completion mode to SHA-256 only. The local service record still completes and the proof can be written to EVM later.
