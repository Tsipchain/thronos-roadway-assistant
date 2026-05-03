"use client";

import { useState } from "react";

type Order = {
  id: string;
  status: string;
  btcAmount: number;
  eurAmount: number;
  rateEurPerBtc: number;
  feeEur: number;
  paymentRef: string;
  paymentMethod: string;
  destinationBtc: string;
  btcTxHash: string | null;
  quoteExpiresAt: string;
  createdAt: string;
  tenant: { name: string; slug: string } | null;
  user: { name: string | null; email: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  QUOTE: "Εκκρεμής",
  PAID: "EUR Πληρώθηκε",
  SENT: "BTC Στάλθηκε",
  COMPLETED: "Ολοκληρωμένη",
  EXPIRED: "Έληξε",
  CANCELLED: "Ακυρώθηκε",
};

const STATUS_COLORS: Record<string, string> = {
  QUOTE: "bg-amber-500/20 text-amber-300",
  PAID: "bg-blue-500/20 text-blue-300",
  SENT: "bg-purple-500/20 text-purple-300",
  COMPLETED: "bg-green-500/20 text-green-300",
  EXPIRED: "bg-slate-500/20 text-slate-400",
  CANCELLED: "bg-red-500/20 text-red-300",
};

export default function P2POrdersPanel({ orders: initial }: { orders: Order[] }) {
  const [orders, setOrders] = useState(initial);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState<string | null>(null);
  const [bankRef, setBankRef] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  async function confirmPayment(orderId: string) {
    const ref = bankRef[orderId]?.trim();
    if (!ref) {
      setError("Εισάγετε αριθμό τραπεζικής συναλλαγής.");
      return;
    }
    setError(null);
    setLoading(orderId);
    try {
      const res = await fetch(`/api/p2p/order/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankRef: ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Σφάλμα");
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "SENT", btcTxHash: data.txHash } : o)));
      setExpanded(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Σφάλμα");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["ALL", "QUOTE", "PAID", "SENT", "COMPLETED", "EXPIRED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === s
                ? "border-purple-500 bg-purple-500/20 text-purple-200"
                : "border-white/10 text-slate-400 hover:border-white/30"
            }`}
          >
            {s === "ALL" ? "Όλες" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Δεν υπάρχουν παραγγελίες.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="border border-white/10 rounded-xl overflow-hidden"
            >
              {/* Row */}
              <button
                className="w-full text-left px-5 py-4 hover:bg-white/5 transition"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-slate-400 truncate">{order.paymentRef}</div>
                      <div className="text-sm font-medium">
                        {order.btcAmount.toFixed(6)} BTC
                        <span className="text-slate-400 ml-2 text-xs">({order.eurAmount.toFixed(2)} EUR)</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">{order.tenant?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString("el-GR")}</div>
                  </div>
                </div>
              </button>

              {/* Expanded */}
              {expanded === order.id && (
                <div className="px-5 pb-5 bg-black/20 border-t border-white/5">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm mb-4">
                    <div>
                      <div className="text-slate-500 text-xs">Tenant</div>
                      <div>{order.tenant?.name ?? "—"} ({order.tenant?.slug})</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Χρήστης</div>
                      <div>{order.user?.name ?? order.user?.email ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Μέθοδος</div>
                      <div>{order.paymentMethod}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">BTC Προορισμός</div>
                      <div className="font-mono text-xs break-all">{order.destinationBtc}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Ισοτιμία</div>
                      <div>{order.rateEurPerBtc.toLocaleString("el-GR")} EUR/BTC</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Προμήθεια</div>
                      <div>{order.feeEur.toFixed(2)} EUR</div>
                    </div>
                    {order.btcTxHash && (
                      <div className="col-span-2 md:col-span-3">
                        <div className="text-slate-500 text-xs">TX Hash</div>
                        <div className="font-mono text-xs break-all text-purple-300">{order.btcTxHash}</div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Action */}
                  {order.status === "QUOTE" && (
                    <div className="mt-2 flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-slate-400 mb-1 block">Αριθμός Τραπεζικής Συναλλαγής</label>
                        <input
                          type="text"
                          placeholder="π.χ. 2024GR123456789"
                          value={bankRef[order.id] ?? ""}
                          onChange={(e) => setBankRef((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <button
                        onClick={() => confirmPayment(order.id)}
                        disabled={loading === order.id}
                        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm px-5 py-2 rounded-lg transition"
                      >
                        {loading === order.id ? "Επεξεργασία..." : "Επιβεβαίωση EUR → Στείλε BTC"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
