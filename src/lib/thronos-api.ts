// Client for the Thronos Chain master node
const THRONOS_NODE = process.env.THRONOS_NODE_URL ?? "https://thrchain.up.railway.app";
const MIN_BTC_PLEDGE = 0.011;

export interface ThrWalletBalance {
  thr: number;
  wbtc: number;
  wusdc: number;
}

export interface ThrPledgeStatus {
  eligible: boolean;
  btcPledged: number;
  minRequired: number;
  thrAddress: string | null;
  btcAddress: string | null;
}

export async function checkPledgeStatus(thrAddress: string): Promise<ThrPledgeStatus> {
  try {
    const res = await fetch(
      `${THRONOS_NODE}/api/wallet/balances?address=${encodeURIComponent(thrAddress)}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error("node error");
    const data = await res.json();

    // wbtc balance represents bridged/pledged BTC equivalent
    const btcPledged: number = data?.balances?.thronos?.wbtc ?? 0;

    return {
      eligible: btcPledged >= MIN_BTC_PLEDGE,
      btcPledged,
      minRequired: MIN_BTC_PLEDGE,
      thrAddress,
      btcAddress: data?.balances?.addresses?.btc ?? null,
    };
  } catch {
    return {
      eligible: false,
      btcPledged: 0,
      minRequired: MIN_BTC_PLEDGE,
      thrAddress,
      btcAddress: null,
    };
  }
}

export async function getThrBalance(thrAddress: string): Promise<number> {
  try {
    const res = await fetch(
      `${THRONOS_NODE}/api/wallet/profile?address=${encodeURIComponent(thrAddress)}`,
      { next: { revalidate: 30 } }
    );
    const data = await res.json();
    return data?.thr_balance ?? 0;
  } catch {
    return 0;
  }
}

export async function sendThrReward(
  fromAddress: string,
  toAddress: string,
  amount: number,
  authSecret: string,
  reason: string
): Promise<{ ok: boolean; txHash?: string; error?: string }> {
  try {
    const res = await fetch(`${THRONOS_NODE}/api/wallet/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_address: fromAddress,
        to_address: toAddress,
        amount,
        auth_secret: authSecret,
        memo: reason,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "send failed" };
    }
    return { ok: true, txHash: data.tx_id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function createThrWallet(label: string): Promise<{ address: string } | null> {
  try {
    const res = await fetch(`${THRONOS_NODE}/api/wallet/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.address ? { address: data.address } : null;
  } catch {
    return null;
  }
}
