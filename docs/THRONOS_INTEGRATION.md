# Thronos Integration Guide

## Overview

The roadway-assistant is integrated with the Thronos V3.6 blockchain via:

1. **Redis caching** (Railway) — Real-time technician location cache
2. **PostgreSQL** (Neon) — Core database
3. **Thronos EVM** (Railway) — Smart contract interactions
4. **Thronos Node API** — Attestations and chain operations

## Automatic Environment Sync

### 1. Generate Bridge Configuration

Run this to sync Thronos deployment values to roadway-assistant:

```bash
npx tsx scripts/sync-thronos-env.ts
```

This reads:
- `../../thronos-v3.6/.env` — Node URLs, RPC config
- `../../thronos-v3.6/deployment.json` — Contract addresses (if available)

Generates:
- `.env.thronos-bridge` — Auto-synced configuration

### 2. Review Generated Config

```bash
cat .env.thronos-bridge
```

Verify all values are correct. If deployment output is missing:

```bash
cd ../thronos-v3.6
npm run chain:deploy:thronos
cd ../thronos-roadway-assistant
npx tsx scripts/sync-thronos-env.ts  # Re-run to capture contract addresses
```

### 3. Set Railway Variables

For Railway deployment, copy values to Railway dashboard:

```bash
bash scripts/railway-sync-config.sh
```

Or manually set in Railway → Variables:

| Variable | Source | Security |
|----------|--------|----------|
| `THRONOS_NODE_URL` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_EVM_RPC_URL` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_CHAIN_ID` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_ESCROW_CONTRACT` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_SERVICEBOOK_CONTRACT` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_REWARD_VAULT_CONTRACT` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_REWARD_TOKEN_ADDRESS` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_PLATFORM_WALLET` | `.env.thronos-bridge` | Public ✅ |
| `THRONOS_DEPLOYER_PRIVATE_KEY` | Manual - Thronos deployment | 🔐 Secret |
| `THRONOS_PLATFORM_PRIVATE_KEY` | Manual - Thronos wallet | 🔐 Secret |
| `THRONOS_ATTESTATION_API_KEY` | Manual - Generate | 🔐 Secret |

### 4. Manual Secret Setup

For sensitive values, you MUST set manually:

```bash
# Generate attestation key
openssl rand -hex 32
# → use output for THRONOS_ATTESTATION_API_KEY

# Get deployer private key from Thronos
cat ../thronos-v3.6/.env | grep THRONOS_DEPLOYER_PRIVATE_KEY
# → set in Railway Variables

# Get platform private key
cat ../thronos-v3.6/.env | grep THRONOS_PLATFORM_PRIVATE_KEY
# → set in Railway Variables
```

## File Structure

```
scripts/
├── sync-thronos-env.ts          # Sync script (TypeScript)
├── railway-sync-config.sh       # Railway helper (Bash)
└── ...

docs/
├── THRONOS_INTEGRATION.md       # This file
└── ...

.env.thronos-bridge             # Auto-generated (DO NOT commit)
.env.thronos-bridge.example     # Template for reference
```

## Integration Points

### 1. Attestation API

When a service request is completed:

```typescript
// src/lib/thronos-api.ts
const attestationResponse = await fetch(
  `${process.env.THRONOS_ATTESTATION_ENDPOINT}/api/commerce/attest`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.THRONOS_ATTESTATION_API_KEY,
    },
    body: JSON.stringify({
      type: 'service_completion',
      request_id: requestId,
      amount: finalPrice,
      ...
    }),
  }
);
```

### 2. Smart Contracts

Escrow operations use contract addresses:

```typescript
// src/lib/contracts.ts
const escrow = new Contract(
  process.env.THRONOS_ESCROW_CONTRACT,
  ESCROW_ABI,
  provider
);

const tx = await escrow.lock({
  amount: ethers.parseEther(price.toString()),
  recipient: technicianWallet,
});
```

### 3. Chain Operations

Redis caching + Thronos API:

```typescript
// src/lib/dispatch.ts
// 1. Check Redis for nearby technicians (fast)
// 2. If hit, return immediately
// 3. If miss, query PostgreSQL
// 4. Warm Redis cache for next time
// 5. Optional: Record dispatch attempt on-chain
```

## Troubleshooting

### Script fails: "Thronos .env not found"

```bash
# Ensure thronos-v3.6 is cloned in parent directory
ls ../../thronos-v3.6/.env
```

### Contract addresses are 0x000...

Deploy contracts first:

```bash
cd ../thronos-v3.6
npm run chain:deploy:thronos
```

Then re-run sync:

```bash
cd ../thronos-roadway-assistant
npx tsx scripts/sync-thronos-env.ts
```

### Railway sync fails with "railway CLI not found"

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Try sync again
bash scripts/railway-sync-config.sh
```

## CI/CD Integration

In your `.github/workflows/deploy.yml`:

```yaml
- name: Sync Thronos Environment
  run: npx tsx scripts/sync-thronos-env.ts
  
- name: Deploy to Railway
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
  run: |
    npm i -g @railway/cli
    bash scripts/railway-sync-config.sh
```

## Security Checklist

- [ ] `.env.thronos-bridge` added to `.gitignore`
- [ ] Private keys set in Railway Variables (NOT in code)
- [ ] `THRONOS_ATTESTATION_API_KEY` is unique and strong
- [ ] No secrets in commit history
- [ ] Railway Variables are marked as sensitive

## Next Steps

1. ✅ Run `npx tsx scripts/sync-thronos-env.ts`
2. ✅ Review `.env.thronos-bridge`
3. ✅ Set values in Railway dashboard
4. ✅ Test attestation: `curl -X POST https://thrchain.up.railway.app/api/commerce/attest`
5. ✅ Deploy roadway-assistant

---

**Questions?** Check `.env.thronos-bridge.example` or contact the team.
