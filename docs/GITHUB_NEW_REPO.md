# Push to a new GitHub repo

Create the empty repository first:

```text
Tsipchain/thronos-roadside-assist
```

Then from this folder:

```bash
git init
git add .
git commit -m "Initial Thronos roadside assist MVP"
git branch -M main
git remote add origin https://github.com/Tsipchain/thronos-roadside-assist.git
git push -u origin main
```

After push, create these issues for Codex:

## Issue 1: Add production auth and role checks

Add auth/session enforcement to every customer, technician and admin API route. Add role checks for service creation, acceptance, completion and catalogue management.

## Issue 2: Add admin catalogue UI

Build admin pages for partners, technicians, service areas, batteries, tyres and vehicle fitments. Reuse the Prisma models and CSV importer.

## Issue 3: Add technician Flutter API endpoints

Implement `/api/technicians/me/location` and `/api/technicians/me/jobs`, including JWT/session auth and filtering by technician ID.

## Issue 4: Add Thronos integration tests

Test EVM RPC health, chain ID, SHA-256 attestation payload format, service completion hash, and optional EVM service-book transaction.

## Issue 5: Add payment flow

Implement Stripe hold/capture first, then optional Thronos escrow. Do not make crypto mandatory for first customer pilot.
