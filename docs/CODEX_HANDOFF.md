# Codex Handoff

## Current status

The MVP has:

- Next.js app foundation
- Prisma/PostgreSQL schema
- dispatch by radius
- technician accept/complete endpoints
- partner/service-area/product catalogue models
- CSV real-data importer
- Thronos native EVM config
- Hardhat deploy scripts
- SHA-256 attestation service
- starter ABI/contract layer

## High-priority Codex tasks

1. Add automated tests for:
   - dispatch candidate ordering
   - CSV importer
   - attestation hash determinism
   - service completion transaction
   - Thronos RPC health
2. Add admin UI pages for:
   - partners
   - technicians
   - service areas
   - battery catalogue
   - tyre catalogue
   - vehicle fitment rules
3. Add auth/session enforcement to API routes.
4. Add role checks:
   - customer can create request
   - technician can accept only assigned/nearby requests
   - admin can manage catalogues
5. Add payment flow:
   - Stripe card hold/capture
   - optional Thronos escrow
   - cash/manual mode for first pilots
6. Add notification flow:
   - technician push notification
   - fallback SMS/call center notification
   - dispatch retry when no response
7. Add Flutter API contract implementation.
8. Replace manual vehicle matching with plate/VIN provider when available.

## Important design decisions

- Customer PII and live GPS stay off-chain.
- Thronos gets hashes/proofs, not private records.
- SHA-256 attestation is default for first launch.
- Native EVM service-book records are enabled when contracts are deployed and gas/reliability are verified.
- Flutter app should use the same REST API first; WebSockets can be added after the basic loop is stable.

## Definition of done for first pilot

- One city area works.
- At least 3 real technicians imported.
- At least 20 battery SKUs imported.
- Request to acceptance time under 60 seconds.
- Arrival ETA is visible.
- Completion proof exists in DB and Thronos attestation.
- Admin can see failed/unaccepted requests.
