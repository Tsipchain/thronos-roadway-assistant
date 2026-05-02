# Thronos native config for Battery / Tire Roadside Assist

This MVP supports two Thronos lanes:

1. **Native Thronos EVM** for Solidity contracts: escrow, service book, reward vault.
2. **SHA-256 Thronos node attestation** for lightweight proof records, compatible with the existing ecosystem pattern used by `thronos-commerce`.

## Correct env split

Use this rule and you will avoid the classic mess: **node API is not always EVM RPC**.

```env
# Thronos ecosystem API / attestation node
THRONOS_NODE_URL="https://thrchain.up.railway.app"
THRONOS_GATEWAY_URL="https://thronoschain.vercel.app"
THRONOS_ATTESTATION_ENDPOINT="https://thrchain.up.railway.app/api/commerce/attest"
THRONOS_ATTESTATION_API_KEY="..."

# Native EVM JSON-RPC endpoint
THRONOS_EVM_RPC_URL="https://YOUR_THRONOS_EVM_RPC_URL"
NEXT_PUBLIC_THRONOS_EVM_RPC_URL="https://YOUR_THRONOS_EVM_RPC_URL"
THRONOS_CHAIN_ID="YOUR_CHAIN_ID"
NEXT_PUBLIC_THRONOS_CHAIN_ID="YOUR_CHAIN_ID"
NEXT_PUBLIC_THRONOS_CHAIN_NAME="Thronos EVM"
NEXT_PUBLIC_THRONOS_NATIVE_SYMBOL="THR"
NEXT_PUBLIC_THRONOS_EXPLORER_URL="https://YOUR_THRONOS_EXPLORER"

# Server-only keys and contract addresses
THRONOS_PLATFORM_PRIVATE_KEY="0x..."
THRONOS_DEPLOYER_PRIVATE_KEY="0x..."
THRONOS_PLATFORM_WALLET="0x..."
THRONOS_ESCROW_CONTRACT="0x..."
THRONOS_SERVICEBOOK_CONTRACT="0x..."
THRONOS_REWARD_VAULT_CONTRACT="0x..."
THRONOS_REWARD_TOKEN_ADDRESS="0x..."
```

Do **not** put private keys in `NEXT_PUBLIC_*`. Those go to the browser. A private key in the browser is not a key; it is a donation.

## Verify env

```bash
npm run chain:verify-env
```

This calls the EVM RPC and checks that returned `eth_chainId` matches `THRONOS_CHAIN_ID`.

## Deploy contracts to Thronos EVM

```bash
npm run chain:compile
npm run chain:deploy:thronos
```

The deploy script writes:

- `deployments/thronos.json`
- `src/contracts/addresses/thronos.json`

Then copy the printed addresses into `.env`:

```env
THRONOS_ESCROW_CONTRACT="0x..."
THRONOS_SERVICEBOOK_CONTRACT="0x..."
THRONOS_REWARD_VAULT_CONTRACT="0x..."
```

## SHA-256 service attestation

When a job completes, the app can create a canonical JSON payload and hash it with SHA-256. The hash is sent to the Thronos node attestation endpoint.

Completion endpoint:

```bash
POST /api/service-requests/:id/complete
```

Payload examples:

```json
{
  "finalPrice": 70,
  "partsUsed": ["12V 70Ah AGM battery"],
  "technicianNotes": "Battery replaced and charging checked",
  "attestationMode": "sha256"
}
```

or both SHA-256 node attestation and EVM ServiceBook:

```json
{
  "finalPrice": 70,
  "partsUsed": ["12V 70Ah AGM battery"],
  "attestationMode": "both",
  "metadataUri": "ipfs://..."
}
```

## Privacy rule

Never store raw plate, VIN, phone, GPS trail or customer identity on-chain. Store hashes and proof references. PostgreSQL keeps the operational truth; Thronos keeps the seal.
