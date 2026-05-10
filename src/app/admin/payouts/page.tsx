"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Payout = {
  id: string;
  tenantId: string;
  jobId: string | null;
  grossAmountEur: number;
  feePercent: number;
  feeAmountEur: number;
  netAmountEur: number;
  status: string;
  method: string;
  bankRef: string | null;
  cryptoTxHash: string | null;
  paidAt: string | null;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    payoutMethod: string;
    payoutIban: string | null;
    payoutWalletAddress: string | null;
  };
};

type Totals = {
  _sum: { netAmountEur: number | null; feeAmountEur: number | null; grossAmountEur: number | null };
  _count: number;
};

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "🏦 Τράπεζα",
  USDC_ETH: "💵 USDC",
  USDT_ETH: "💵 USDT",
  SUBSCRIPTION_OFFSET: "📋 Subscription",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-300",
  PROCESSING: "bg-blue-500/20 text-blue-300",
  PAID: "bg-green-500/20 text-green-300",
  OFFSET: "bg-slate-500/20 text-slate-400",
};

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [filter, setFilter] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Payout | null>(null);
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const load = async (status = filter) => {
    setLoading(true);
    const res = await fetch(`/api/admin/payouts?status=${status}`);
    if (res.ok) {
      const data = await res.json();
      setPayouts(data.payouts);
      setTotals(data.totals);
    }
    setLoading(false);
  };

  useEffect(() => { load(filter); }, [filter]);

  const markPaid = async () => {
    if (!modal) return;
    setSaving(true);
    const isCrypto = modal.method === "USDC_ETH" || modal.method === "USDT_ETH";
    const res = await fetch("/api/admin/payouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payoutId: modal.id,
        ...(isCrypto ? { cryptoTxHash: ref } : { bankRef: ref }),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSuccessId(modal.id);
      setModal(null);
      setRef("");
      load(filter);
      setTimeout(() => setSuccessId(null), 3000);
    }
  };

  // Group pending payouts by tenant
  const grouped = payouts.reduce<Record<string, { tenant: Payout["tenant"]; items: Payout[] }>>((acc, p) => {
    if (!acc[p.tenantId]) acc[p.tenantId] = { tenant: p.tenant, items: [] };
    acc[p.tenantId].items.push(p);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-slate-400 hover:text-slate-200 text-sm">← Admin</Link>
            <div className="text-slate-600">/</div>
            <h1 className="text-xl font-bold">Payouts Tenants</h1>
          </div>
        </div>

        {/* Stats */}
        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="text-3xl font-bold text-amber-400">{totals._count}</div>
              <div className="text-slate-400 text-sm mt-1">Εκκρεμή payouts</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="text-3xl font-bold text-green-400">
                {(totals._sum.netAmountEur ?? 0).toFixed(2)}€
              </div>
              <div className="text-slate-400 text-sm mt-1">Οφειλόμενο (net)</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="text-3xl font-bold text-purple-400">
                {(totals._sum.feeAmountEur ?? 0).toFixed(2)}€
              </div>
              <div className="text-slate-400 text-sm mt-1">Platform fees</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="text-3xl font-bold text-blue-400">
                {(totals._sum.grossAmountEur ?? 0).toFixed(2)}€
              </div>
              <div className="text-slate-400 text-sm mt-1">Gross (customer paid)</div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {["PENDING", "PROCESSING", "PAID", "OFFSET", "ALL"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                filter === s
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {s === "PENDING" ? "Εκκρεμή" : s === "PAID" ? "Πληρωμένα" : s === "OFFSET" ? "Subscription" : s === "ALL" ? "Όλα" : s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Φόρτωση...</div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">✅</div>
            <p>Δεν υπάρχουν εκκρεμή payouts.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(grouped).map(({ tenant, items }) => {
              const tenantNet = items.reduce((s, p) => s + p.netAmountEur, 0);
              return (
                <div key={tenant.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  {/* Tenant header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                      <span className="font-semibold">{tenant.name}</span>
                      <span className="text-slate-500 text-sm ml-2">/{tenant.slug}</span>
                      {tenant.payoutIban && (
                        <span className="text-slate-400 text-xs ml-3 font-mono">{tenant.payoutIban}</span>
                      )}
                      {tenant.payoutWalletAddress && (
                        <span className="text-slate-400 text-xs ml-3 font-mono">{tenant.payoutWalletAddress.slice(0,10)}…</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-green-400 font-bold text-lg">{tenantNet.toFixed(2)}€</span>
                      <span className="text-slate-500 text-sm">{METHOD_LABELS[tenant.payoutMethod] ?? tenant.payoutMethod}</span>
                    </div>
                  </div>

                  {/* Payout rows */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-white/5">
                        <th className="px-6 py-2 text-left">Job ID</th>
                        <th className="px-4 py-2 text-right">Gross</th>
                        <th className="px-4 py-2 text-right">Fee %</th>
                        <th className="px-4 py-2 text-right">Net</th>
                        <th className="px-4 py-2 text-center">Μέθοδος</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-6 py-3 font-mono text-xs text-slate-400">
                            {p.jobId ? p.jobId.slice(-8) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{p.grossAmountEur.toFixed(2)}€</td>
                          <td className="px-4 py-3 text-right text-slate-400">{p.feePercent}%</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-300">{p.netAmountEur.toFixed(2)}€</td>
                          <td className="px-4 py-3 text-center text-xs">{METHOD_LABELS[p.method] ?? p.method}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[p.status] ?? ""}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {p.status === "PENDING" && (
                              <button
                                onClick={() => { setModal(p); setRef(""); }}
                                className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg transition font-medium"
                              >
                                ✓ Εξοφλήθηκε
                              </button>
                            )}
                            {p.status === "PAID" && (
                              <span className="text-slate-500 text-xs">{p.bankRef ?? p.cryptoTxHash?.slice(0, 10) ?? "—"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* Mark Paid Modal */}
        {modal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold mb-1">Επιβεβαίωση εξόφλησης</h3>
              <p className="text-slate-400 text-sm mb-4">
                {modal.tenant.name} · {modal.netAmountEur.toFixed(2)}€ net
              </p>

              <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Μέθοδος</span>
                  <span>{METHOD_LABELS[modal.method] ?? modal.method}</span>
                </div>
                {modal.tenant.payoutIban && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">IBAN</span>
                    <span className="font-mono text-xs">{modal.tenant.payoutIban}</span>
                  </div>
                )}
                {modal.tenant.payoutWalletAddress && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Wallet</span>
                    <span className="font-mono text-xs">{modal.tenant.payoutWalletAddress}</span>
                  </div>
                )}
              </div>

              <label className="block text-sm text-slate-400 mb-1">
                {modal.method === "USDC_ETH" || modal.method === "USDT_ETH"
                  ? "Crypto TX Hash"
                  : "Αναφορά τραπεζικής μεταφοράς"}
              </label>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder={modal.method === "USDC_ETH" || modal.method === "USDT_ETH" ? "0x..." : "Αρ. παραστατικού / SEPA ref"}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:border-green-500"
              />

              <div className="flex gap-3">
                <button
                  onClick={markPaid}
                  disabled={saving || !ref.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
                >
                  {saving ? "Αποθήκευση..." : "✓ Επιβεβαίωση εξόφλησης"}
                </button>
                <button
                  onClick={() => setModal(null)}
                  className="px-5 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 text-sm transition"
                >
                  Ακύρωση
                </button>
              </div>
            </div>
          </div>
        )}

        {successId && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-lg z-50 font-medium">
            ✅ Payout επιβεβαιώθηκε
          </div>
        )}
      </div>
    </main>
  );
}
