// Thronos Chain master node client
// Node: https://thrchain.up.railway.app
// Confirmed endpoints from server.py v3.6

const THRONOS_NODE = process.env.THRONOS_NODE_URL ?? "https://thrchain.up.railway.app";
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
const MIN_BTC_PLEDGE = 0.011;

export interface ThrPledgeStatus {
  eligible: boolean;
  btcPledged: number;
  minRequired: number;
  thrAddress: string | null;
  btcAddress: string | null;
  pledgeHash: string | null;
}

export interface PledgeSubmitResult {
  status: "verified" | "already_verified" | "pending";
  thrAddress: string;
  pledgeHash: string;
  sendSecret?: string; // returned once — partner must save this
}

// ─── Pledge ──────────────────────────────────────────────────────────────────

/** Submit a BTC address to the chain to get a THR wallet + pledge hash */
export async function submitPledge(
  btcAddress: string,
  pledgeText: string
): Promise<PledgeSubmitResult | null> {
  try {
    const res = await fetch(`${THRONOS_NODE}/pledge_submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ btc_address: btcAddress, pledge_text: pledgeText }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.thr_address) return null;
    return {
      status: data.status,
      thrAddress: data.thr_address,
      pledgeHash: data.pledge_hash,
      sendSecret: data.send_secret,
    };
  } catch {
    return null;
  }
}

/** Check pledge status for a THR address */
export async function checkPledgeStatus(thrAddress: string): Promise<ThrPledgeStatus> {
  try {
    const res = await fetch(
      `${THRONOS_NODE}/api/pledge/status?thr_address=${encodeURIComponent(thrAddress)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error("node error");
    const data = await res.json();

    const btcPledged: number =
      data?.btc_pledged ?? data?.btc_amount ?? data?.balances?.wbtc ?? 0;

    return {
      eligible: btcPledged >= MIN_BTC_PLEDGE,
      btcPledged,
      minRequired: MIN_BTC_PLEDGE,
      thrAddress,
      btcAddress: data?.btc_address ?? null,
      pledgeHash: data?.pledge_hash ?? null,
    };
  } catch {
    return {
      eligible: false,
      btcPledged: 0,
      minRequired: MIN_BTC_PLEDGE,
      thrAddress,
      btcAddress: null,
      pledgeHash: null,
    };
  }
}

// ─── Balance ─────────────────────────────────────────────────────────────────

/** GET /api/balance/<thr_addr> → { balance, transactions } */
export async function getThrBalance(thrAddress: string): Promise<number> {
  try {
    const res = await fetch(
      `${THRONOS_NODE}/api/balance/${encodeURIComponent(thrAddress)}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.balance ?? data?.thr_balance ?? 0;
  } catch {
    return 0;
  }
}

// ─── Send THR ─────────────────────────────────────────────────────────────────

/**
 * POST /send_thr
 * Body: { from_thr, to_thr, amount, auth_secret }
 * auth_secret = THRONOS_PLATFORM_KEY (platform master wallet secret)
 */
export async function sendThrReward(
  fromAddress: string,
  toAddress: string,
  amount: number,
  authSecret: string,
  reason: string
): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  try {
    const res = await fetch(`${THRONOS_NODE}/send_thr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_thr: fromAddress,
        to_thr: toAddress,
        amount,
        auth_secret: authSecret,
        // memo is not in the spec but some server versions accept it
        memo: reason,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.status !== "ok") {
      return { ok: false, error: data.error ?? data.message ?? "send failed" };
    }
    return { ok: true, txHash: data.tx?.tx_id ?? data.tx_id };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

// ─── Wallet creation ─────────────────────────────────────────────────────────

/**
 * The chain creates wallets via /pledge_submit (requires BTC address).
 * For team member wallets we generate a THR address locally and activate
 * it by sending a tiny amount of THR — the chain ledger auto-creates the entry.
 * Format matches chain: THR{timestamp_ms}
 */
export function generateThrAddress(): string {
  return `THR${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Activate a new THR address by sending 0.0001 THR from the platform wallet */
export async function activateThrWallet(
  newAddress: string
): Promise<{ ok: boolean; address: string }> {
  const platformFrom = process.env.THRONOS_PLATFORM_ADDRESS ?? "";
  const platformKey = process.env.THRONOS_PLATFORM_KEY ?? "";

  if (!platformFrom || !platformKey) {
    // In dev / unconfigured: return address as-is (activation deferred)
    return { ok: true, address: newAddress };
  }

  const result = await sendThrReward(
    platformFrom,
    newAddress,
    0.0001,
    platformKey,
    "wallet_activation"
  );

  return { ok: result.ok, address: newAddress };
}

// ─── BTC bridge / P2P withdrawal ─────────────────────────────────────────────

/**
 * POST /api/bridge/withdraw
 * Used by the P2P desk to send BTC from the platform hot wallet to the buyer.
 */
export async function triggerBtcSend(
  toAddress: string,
  amount: number
): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  try {
    const res = await fetch(`${THRONOS_NODE}/api/bridge/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: ADMIN_SECRET,
        to_address: toAddress,
        amount,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "withdraw failed" };
    }
    return { ok: true, txHash: data.tx_hash ?? data.txid };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/** The BTC address partners should send their pledge BTC to */
export function getPledgeVaultAddress(): string {
  return process.env.BTC_PLEDGE_VAULT ?? "";
}
