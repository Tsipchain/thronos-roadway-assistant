"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Settings = {
  payoutMethod: string;
  payoutIban: string | null;
  payoutBic: string | null;
  payoutWalletAddress: string | null;
  platformFeePercent: number;
};

type Payout = {
  id: string;
  grossAmountEur: number;
  feePercent: number;
  feeAmountEur: number;
  netAmountEur: number;
  status: string;
  method: string;
  paidAt: string | null;
  bankRef: string | null;
  cryptoTxHash: string | null;
  createdAt: string;
};

const METHOD_LABELS: Record<string, { label: string; desc: string }> = {
  BANK_TRANSFER:      { label: "🏦 Τραπεζικό Έμβασμα (SEPA)", desc: "Μεταφορά σε IBAN μέσα σε 1-3 εργάσιμες" },
  USDC_ETH:           { label: "💵 USDC (Ethereum)",            desc: "Stablecoin · χαμηλότερα fees μέσω EtherFi" },
  USDT_ETH:           { label: "💵 USDT (Ethereum)",            desc: "Stablecoin · χαμηλότερα fees μέσω EtherFi" },
  SUBSCRIPTION_OFFSET: { label: "📋 Subscription Offset",       desc: "Καλύπτεται από τη συνδρομή σου — τιμολόγιο τέλος μήνα" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:    { label: "Εκκρεμεί",  color: "text-amber-400" },
  PROCESSING: { label: "Σε εξέλιξη", color: "text-blue-400" },
  PAID:       { label: "Εξοφλήθηκε", color: "text-green-400" },
  OFFSET:     { label: "Subscription", color: "text-slate-400" },
};

export default function PayoutSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [settings, setSettings] = useState<Settings | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [wallet, setWallet] = useState("");

  const load = async () => {
    const res = await fetch(`/api/t/${slug}/payout-settings`);
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setPayouts(data.payouts);
      setPendingTotal(data.pendingTotal);
      setPendingCount(data.pendingCount);
      setMethod(data.settings.payoutMethod);
      setIban(data.settings.payoutIban ?? "");
      setBic(data.settings.payoutBic ?? "");
      setWallet(data.settings.payoutWalletAddress ?? "");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/t/${slug}/payout-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutMethod: method, payoutIban: iban, payoutBic: bic, payoutWalletAddress: wallet }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400">Φόρτωση...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href={`/t/${slug}/admin`} className="text-slate-400 hover:text-slate-200 text-sm">← Admin</Link>
          <div className="text-slate-600">/</div>
          <h1 className="text-xl font-bold">Ρυθμίσεις Πληρωμών & Payouts</h1>
        </div>

        {/* Pending banner */}
        {pendingCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 flex items-center justify-between">
            <div>
              <div className="text-amber-300 font-semibold">Εκκρεμή payouts: {pendingCount}</div>
              <div className="text-slate-400 text-sm mt-0.5">Οφειλόμενο σε εσάς: {pendingTotal.toFixed(2)}€ net</div>
            </div>
            <div className="text-2xl">⏳</div>
          </div>
        )}

        {/* Fee info */}
        {settings && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <div className="text-slate-400 text-sm mb-1">Platform Commission</div>
            <div className="text-2xl font-bold text-purple-400">{settings.platformFeePercent}%</div>
            <div className="text-slate-500 text-xs mt-1">
              Αφαιρείται αυτόματα από κάθε Stripe πληρωμή. Το υπόλοιπο εμβάζεται σε εσάς.
            </div>
          </div>
        )}

        {/* Settlement method */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Μέθοδος εξόφλησης</h2>

          <div className="space-y-3 mb-6">
            {Object.entries(METHOD_LABELS).map(([key, { label, desc }]) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                  method === key
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={key}
                  checked={method === key}
                  onChange={() => setMethod(key)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-sm">{label}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* IBAN / BIC for bank */}
          {method === "BANK_TRANSFER" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-400 block mb-1">IBAN</label>
                <input
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  placeholder="GR16 0110 1250 0000 0001 2300 695"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">BIC / SWIFT (προαιρετικό)</label>
                <input
                  value={bic}
                  onChange={(e) => setBic(e.target.value.toUpperCase())}
                  placeholder="ETHNGRAA"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* ETH wallet for USDC/USDT */}
          {(method === "USDC_ETH" || method === "USDT_ETH") && (
            <div>
              <label className="text-sm text-slate-400 block mb-1">ETH Wallet Address</label>
              <input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x..."
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-purple-500"
              />
              <p className="text-slate-500 text-xs mt-2">
                Εκκαθάριση μέσω EtherFi · χαμηλότερα gas fees · συνήθως εντός 24ω
              </p>
            </div>
          )}

          <button
            onClick={save}
            disabled={saving}
            className="mt-5 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
          >
            {saving ? "Αποθήκευση..." : saved ? "✅ Αποθηκεύτηκε" : "Αποθήκευση ρυθμίσεων"}
          </button>
        </div>

        {/* Payout history */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="font-semibold">Ιστορικό payouts</h2>
          </div>
          {payouts.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">Δεν υπάρχουν payouts ακόμα.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-white/5">
                  <th className="px-6 py-2 text-left">Ημερομηνία</th>
                  <th className="px-4 py-2 text-right">Gross</th>
                  <th className="px-4 py-2 text-right">Fee</th>
                  <th className="px-4 py-2 text-right">Net</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-center">Αναφορά</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => {
                  const s = STATUS_LABELS[p.status];
                  return (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-6 py-3 text-slate-400 text-xs">
                        {new Date(p.createdAt).toLocaleDateString("el-GR")}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{p.grossAmountEur.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">{p.feePercent}% / {p.feeAmountEur.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-300">{p.netAmountEur.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium ${s?.color ?? ""}`}>{s?.label ?? p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">
                        {p.bankRef ?? (p.cryptoTxHash ? `${p.cryptoTxHash.slice(0, 10)}…` : "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </main>
  );
}
