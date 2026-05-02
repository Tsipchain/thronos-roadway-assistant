# Battery / Tire Roadside Assist + Native Thronos EVM MVP

Starter kit for a 24/7 roadside assistance dispatch platform focused on batteries and tires, with native Thronos EVM contracts and SHA-256 attestation support.

## What this MVP includes

- Customer service request flow
- Nearby technician matching using GPS radius
- Technician accept / complete endpoints
- Pricing rules with night and weekend surcharge
- Prisma/PostgreSQL schema for users, vehicles, service requests, technicians, payments, records and rewards
- Native Thronos EVM integration using `ethers`
- SHA-256 attestation lane for Thronos node / ecosystem proofs
- Solidity starter contracts for escrow, service book records and rewards
- ABI service layer under `src/lib/thronos/*`
- Deploy scripts through Hardhat
- Stripe-ready env placeholders
- Push/WebSocket-ready dependencies from the base package

## Apps / surfaces

1. Customer app: request help, share GPS, vehicle profile, pay.
2. Technician app: go online, receive nearby jobs, accept, navigate, complete.
3. Admin panel: manage partners, prices, coverage, disputes, payments.

This repository currently uses Next.js as the web/SaaS foundation. For native mobile, reuse the same API with Flutter for iOS/Android technician and customer apps.

## Setup

```bash
npm install
cp .env.example .env
# edit DATABASE_URL, Thronos env and secrets
npm run db:push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.


## Real data readiness

This updated package includes production-data scaffolding:

- partner companies
- service areas / SLA radius
- technician public wallet + coverage data
- battery catalogue
- tyre catalogue
- vehicle fitment rules
- dispatch attempt tracking
- attestation record tracking
- CSV templates under `data/templates/`
- CSV importer: `npm run import:real-data`

Read:

```bash
cat docs/REAL_DATA_PLAYBOOK.md
cat docs/PRODUCTION_RUNBOOK.md
cat docs/CODEX_HANDOFF.md
cat docs/FLUTTER_TECHNICIAN_APP_API.md
```

Bootstrap demo operational data:

```bash
npm run import:real-data:templates
```

Load real operational data:

```bash
mkdir -p data/import
cp data/templates/*.csv data/import/
# edit data/import/*.csv
npm run import:real-data
```

## Thronos native setup

Read the full env/deploy guide:

```bash
cat docs/THRONOS_NATIVE_CONFIG.md
```

Core commands:

```bash
npm run chain:verify-env
npm run chain:compile
npm run chain:deploy:thronos
```

The deploy script writes contract addresses to `deployments/thronos.json` and `src/contracts/addresses/thronos.json`.

## Completion attestation modes

`POST /api/service-requests/:id/complete` accepts:

- `attestationMode: "off"` — no Thronos write.
- `attestationMode: "sha256"` — canonical JSON + SHA-256 attestation through Thronos node.
- `attestationMode: "evm"` — writes to native Thronos EVM `ServiceBook`.
- `attestationMode: "both"` — does both.

For launch, `sha256` is the practical default: cheap, fast, and already close to the Thronos ecosystem pattern. Use full EVM writes when the record needs stronger public settlement.

## Demo seed

```bash
npm run db:seed
```

Demo credentials use password `ChangeMe123!` for admin, technician and customer. Change them before any real use.

## Test the dispatch endpoint

```bash
curl -X POST http://localhost:3000/api/service-requests \
  -H "Content-Type: application/json" \
  -d '{
    "customerId":"CUSTOMER_ID_FROM_DB",
    "vehicleId":"VEHICLE_ID_FROM_DB",
    "serviceType":"BATTERY_REPLACEMENT",
    "latitude":37.984,
    "longitude":23.728,
    "symptoms":["Δεν παίρνει μπρος"],
    "maxRadiusKm":15
  }'
```

## Important legal note

For Greece, roadside assistance activity may require compliance with the applicable road-assistance framework, business licensing, invoices/receipts, insurance, GDPR and partner contracts. Do not launch commercially before legal/accounting review.
