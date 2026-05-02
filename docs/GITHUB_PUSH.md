# GitHub push notes

Visible GitHub account from the connector: `Tsipchain`.

This app should live in a **new repo**, not inside `driver-platform`. The existing `driver-platform` repo is a FastAPI telemetry/trips/safety-scoring microservice, so mixing this Next.js SaaS in there would make the garden look like a scrapyard.

Recommended repo name:

```text
Tsipchain/thronos-roadside-assist
```

Local push commands after creating the repo on GitHub:

```bash
git init
git branch -M main
git add .
git commit -m "feat: add native Thronos roadside assistance MVP"
git remote add origin git@github.com:Tsipchain/thronos-roadside-assist.git
git push -u origin main
```

Then connect the repo to the rest of the ecosystem through:

- `THRONOS_NODE_URL`
- `THRONOS_EVM_RPC_URL`
- `THRONOS_ATTESTATION_ENDPOINT`
- deployed contract addresses
- shared API key between this app and the Thronos node
