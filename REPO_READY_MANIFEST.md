# Repo-ready manifest

Target repository:

```text
Tsipchain/thronos-roadside-assist
```

## Added in this package

### Production data scaffolding

- `PartnerCompany`
- `ServiceArea`
- `BatteryCatalogItem`
- `TyreCatalogItem`
- `VehicleFitmentRule`
- `DispatchAttempt`
- `AttestationRecord`

### Import pipeline

- `data/templates/*.csv`
- `scripts/import-real-data.ts`
- `npm run import:real-data`
- `npm run import:real-data:templates`

### Technician mobile API starter

- `POST /api/technicians/{id}/location`
- `GET /api/technicians/{id}/jobs?status=NOTIFIED`

### Thronos native layer

- native EVM env split
- Hardhat deploy script
- SHA-256 attestation service
- ABI contract helpers
- service completion attestation persistence

### Docs

- `docs/REAL_DATA_PLAYBOOK.md`
- `docs/PRODUCTION_RUNBOOK.md`
- `docs/CODEX_HANDOFF.md`
- `docs/FLUTTER_TECHNICIAN_APP_API.md`
- `docs/GITHUB_NEW_REPO.md`
- `docs/THRONOS_NATIVE_CONFIG.md`

## What Codex should finish after GitHub push

- production auth and role checks
- admin CRUD UI
- Stripe hold/capture and optional Thronos escrow
- WebSocket/push dispatch notifications
- tests
- Flutter app
- external vehicle data provider
