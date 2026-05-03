"use client";

import { useState } from "react";
import Link from "next/link";

type TenantInfo = {
  slug: string;
  name: string;
  thrWalletAddress: string | null;
  btcPledgeAddress: string | null;
  btcPledgeVerified: number;
  pledgeVerifiedAt: string | null;
  enterpriseEnabled: boolean;
  pledgeHash: string | null;
};

export default function PledgeOnboarding({
  tenant: initial,
  vaultAddress,
}: {
  tenant: TenantInfo;
  vaultAddress: string;
}) {
  const [tenant, setTenant] = useState(initial);
  const [btcAddress, setBtcAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sendSecret, setSendSecret] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{
    btcPledged: number;
    eligible: boolean;
  } | null>(null);

  // ── Step 1: Submit BTC address → get THR wallet ──────────────────────────
  async function handleSubmitAddress() {
    if (!btcAddress.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.slug}/pledge/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ btcAddress: btcAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Σφάλμα");
      setTenant((t) => ({
        ...t,
        thrWalletAddress: data.thrAddress,
        btcPledgeAddress: btcAddress.trim(),
        pledgeHash: data.pledgeHash,
      }));
      if (data.sendSecret) setSendSecret(data.sendSecret);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Σφάλμα");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 3: Check pledge status on-chain ────────────────────────────────
  async function handleCheckStatus() {
    setError(null);
    setChecking(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.slug}/pledge`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Σφάλμα");
      setCheckResult({ btcPledged: data.btcPledged, eligible: data.eligible });
      if (data.enterpriseEnabled) {
        setTenant((t) => ({
          ...t,
          btcPledgeVerified: data.btcPledged,
          enterpriseEnabled: true,
        }));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Σφάλμα");
    } finally {
      setChecking(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* ── Step 1: BTC Address ── */}
      <div
        className={`bg-white/5 border rounded-2xl p-6 ${
          tenant.btcPledgeAddress
            ? "border-green-500/30 opacity-60"
            : "border-white/10"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              tenant.btcPledgeAddress
                ? "bg-green-500/20 text-green-300"
                : "bg-purple-500/20 text-purple-300"
            }`}
          >
            {tenant.btcPledgeAddress ? "✓" : "1"}
          </div>
          <div>
            <div className="font-semibold">Καταχώρηση BTC Address</div>
            <div className="text-slate-400 text-xs">
              Η διεύθυνση από όπου θα αποστείλετε το BTC pledge
            </div>
          </div>
        </div>

        {tenant.btcPledgeAddress ? (
          <div className="font-mono text-sm text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            {tenant.btcPledgeAddress}
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="π.χ. bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
              value={btcAddress}
              onChange={(e) => setBtcAddress(e.target.value)}
              className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
            />
            <button
              onClick={handleSubmitAddress}
              disabled={submitting || !btcAddress.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-sm font-semibold px-5 py-2 rounded-lg transition"
            >
              {submitting ? "Περιμένετε..." : "Καταχώρηση"}
            </button>
          </div>
        )}
      </div>

      {/* ── THR Wallet Result (after step 1) ── */}
      {tenant.thrWalletAddress && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5">
          <div className="text-xs text-slate-400 mb-1">Το THR Wallet σας</div>
          <div className="font-mono text-sm text-purple-200 break-all mb-1">
            {tenant.thrWalletAddress}
          </div>
          {tenant.pledgeHash && (
            <div className="text-xs text-slate-500 font-mono">
              pledge_hash: {tenant.pledgeHash.slice(0, 20)}…
            </div>
          )}
        </div>
      )}

      {/* ── Send Secret (one-time) ── */}
      {sendSecret && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 font-semibold text-sm">🔑 Send Secret — Αποθηκεύστε το τώρα!</span>
          </div>
          <p className="text-slate-400 text-xs mb-3">
            Αυτό είναι το auth_secret του THR wallet σας. Εμφανίζεται ΜΟΝΟ μία φορά.
            Χρειάζεται αν θέλετε να στέλνετε THR από το personal wallet σας.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 bg-black/40 border border-amber-500/20 rounded px-3 py-2 text-xs font-mono break-all">
              {sendSecret}
            </code>
            <button
              onClick={() => copyToClipboard(sendSecret)}
              className="shrink-0 text-xs bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 px-3 py-2 rounded-lg transition"
            >
              {secretCopied ? "✓" : "Αντιγραφή"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Send BTC to Vault ── */}
      {tenant.btcPledgeAddress && (
        <div
          className={`bg-white/5 border rounded-2xl p-6 ${
            tenant.btcPledgeVerified >= 0.011
              ? "border-green-500/30 opacity-60"
              : "border-amber-500/30"
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                tenant.btcPledgeVerified >= 0.011
                  ? "bg-green-500/20 text-green-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {tenant.btcPledgeVerified >= 0.011 ? "✓" : "2"}
            </div>
            <div>
              <div className="font-semibold">Στείλτε BTC στο Pledge Vault</div>
              <div className="text-slate-400 text-xs">Ελάχιστο 0.011 BTC για Enterprise tier</div>
            </div>
          </div>

          {vaultAddress ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">BTC Vault Address</div>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm font-mono break-all">
                    {vaultAddress}
                  </code>
                  <button
                    onClick={() => copyToClipboard(vaultAddress)}
                    className="shrink-0 text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg transition"
                  >
                    Αντιγραφή
                  </button>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-xs text-amber-200">
                Στείλτε από τη BTC address που καταχωρήσατε παραπάνω (
                {tenant.btcPledgeAddress?.slice(0, 12)}…). Δεν γίνεται αποδοχή από άλλες διευθύνσεις.
              </div>
              <div className="text-xs text-slate-400">
                Δεν έχετε BTC ακόμα;{" "}
                <Link
                  href={`/t/${tenant.slug}/admin/buy-btc`}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Αγοράστε μέσω P2P Desk →
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-amber-300 text-sm">
              Ο vault address δεν έχει οριστεί ακόμα. Επικοινωνήστε με το Thronos Chain για να σας δοθεί.
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Verify on chain ── */}
      {tenant.btcPledgeAddress && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                tenant.enterpriseEnabled
                  ? "bg-green-500/20 text-green-300"
                  : "bg-slate-500/20 text-slate-400"
              }`}
            >
              {tenant.enterpriseEnabled ? "✓" : "3"}
            </div>
            <div>
              <div className="font-semibold">Υποβολή στο Chain</div>
              <div className="text-slate-400 text-xs">
                Μετά τη επιβεβαίωση της συναλλαγής (1+ confirmations)
              </div>
            </div>
          </div>

          {checkResult && (
            <div
              className={`text-sm px-4 py-3 rounded-lg mb-3 ${
                checkResult.eligible
                  ? "bg-green-500/10 border border-green-500/20 text-green-300"
                  : "bg-slate-500/10 border border-slate-500/20 text-slate-300"
              }`}
            >
              BTC που εντοπίστηκε: {checkResult.btcPledged.toFixed(6)} BTC
              {checkResult.eligible
                ? " — ✅ Enterprise ενεργοποιήθηκε!"
                : " — αναμένεται επιβεβαίωση (min 0.011 BTC)"}
            </div>
          )}

          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm font-semibold px-5 py-2 rounded-lg transition"
          >
            {checking ? "Ελέγχος chain..." : "Ελεγξος Υποβολής"}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            Ο watcher ελέγχει αυτόματα κάθε 5 λεπτά — μπορείτε να περιμένετε εως 1 Bitcoin confirmation (~10 λεπτά).
          </p>
        </div>
      )}
    </div>
  );
}
