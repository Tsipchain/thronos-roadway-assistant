"use client";
import { useState, useEffect } from "react";

const MIN_PLEDGE = 0.011;

type Rate = {
  btcEur: number;
  source: string;
  fetchedAt: string;
  quoteTtlMinutes: number;
  minBtc: number;
  maxBtc: number;
  pledgeExampleEur: number;
};

type Order = {
  id: string;
  status: string;
  btcAmount: number;
  eurAmount: number;
  rateEurPerBtc: number;
  paymentRef: string | null;
  destinationBtc: string;
  btcTxHash: string | null;
  createdAt: string;
  quoteExpiresAt: string;
};

type Tenant = {
  name: string;
  slug: string;
  btcPledgeVerified: number;
  enterpriseEnabled: boolean;
  thrWalletAddress: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  QUOTE:     { label: "Σε αναμονή πληρωμής", color: "text-amber-300" },
  PAID:      { label: "EUR ελήφθηκαν", color: "text-blue-300" },
  SENT:      { label: "BTC εστάλη",    color: "text-purple-300" },
  COMPLETED: { label: "Ολοκληρώθηκε",   color: "text-green-300" },
  EXPIRED:   { label: "Λήξη",         color: "text-slate-400" },
  CANCELLED: { label: "Ακυρώθηκε",  color: "text-red-300" },
};

export default function BuyBtcDesk({
  tenant,
  recentOrders,
  userId,
}: {
  tenant: Tenant;
  recentOrders: Order[];
  userId: string;
}) {
  const [rate, setRate] = useState<Rate | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [btcAmt, setBtcAmt] = useState("");
  const [destBtc, setDestBtc] = useState("");
  const [payMethod, setPayMethod] = useState<"bank" | "card">("bank");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>(recentOrders);
  const [timer, setTimer] = useState<number | null>(null);

  useEffect(() => {
    fetchRate();
    const iv = setInterval(fetchRate, 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!order?.expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000));
      setTimer(left);
      if (left === 0) clearInterval(iv);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [order?.expiresAt]);

  const fetchRate = async () => {
    try {
      const res = await fetch("/api/p2p/rate");
      const data = await res.json();
      if (data.ok) setRate(data);
    } finally {
      setRateLoading(false);
    }
  };

  const eurEstimate =
    rate && btcAmt && !isNaN(parseFloat(btcAmt))
      ? ((parseFloat(btcAmt) * rate.btcEur * 1.015) + 2).toFixed(2)
      : null;

  const createOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/p2p/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          btcAmount: parseFloat(btcAmt),
          destinationBtc: destBtc,
          paymentMethod: payMethod,
          tenantSlug: tenant.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setOrder(data);
      setOrders((prev) => [{ ...data, status: "QUOTE", createdAt: new Date().toISOString(), quoteExpiresAt: data.expiresAt } as Order, ...prev]);
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (s: number | null) => {
    if (s === null) return "--:--";
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <a href={`/t/${tenant.slug}/admin`} className="text-slate-400 hover:text-white transition">← Admin</a>
          <h1 className="text-xl font-bold">Αγορά BTC — P2P Desk</h1>
        </div>

        {/* Enterprise status hint */}
        {!tenant.enterpriseEnabled && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 text-sm text-amber-200">
            🔒 Αγοράστε <strong>{MIN_PLEDGE} BTC</strong> για να ενεργοποιήσετε το Enterprise tier και να αποκτήσετε THR wallets για την ομάδα σας.
          </div>
        )}

        {/* Live Rate */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">BTC / EUR — Live</div>
              {rateLoading ? (
                <div className="text-3xl font-bold text-slate-500 animate-pulse">…</div>
              ) : rate ? (
                <div className="text-3xl font-bold text-amber-400">
                  {rate.btcEur.toLocaleString("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                </div>
              ) : (
                <div className="text-red-400 text-sm">Αποτυχία λήψης τιμής</div>
              )}
              {rate && (
                <div className="text-xs text-slate-500 mt-1">
                  Spread: 1.5% + 2€ · {rate.source} · {new Date(rate.fetchedAt).toLocaleTimeString("el-GR")}
                </div>
              )}
            </div>
            {rate && (
              <div className="text-right text-sm">
                <div className="text-slate-400">0.011 BTC ≈</div>
                <div className="text-purple-300 font-bold">{rate.pledgeExampleEur}€</div>
              </div>
            )}
          </div>
        </div>

        {step === "form" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold">Νέα Αγορά</h2>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Ποσό BTC</label>
              <div className="relative">
                <input
                  type="number"
                  value={btcAmt}
                  onChange={(e) => setBtcAmt(e.target.value)}
                  min={rate?.minBtc ?? 0.001}
                  max={rate?.maxBtc ?? 0.5}
                  step="0.001"
                  placeholder="0.011"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition pr-16"
                />
                <span className="absolute right-4 top-3 text-slate-400 text-sm">BTC</span>
              </div>
              {eurEstimate && (
                <div className="text-amber-300 text-sm mt-1.5">
                  ≈ <strong>{eurEstimate} €</strong> (συμπεριλαμβάνεται spread + τέλος)
                </div>
              )}
              <div className="text-xs text-slate-500 mt-1">
                Min {rate?.minBtc ?? "0.001"} BTC · Max {rate?.maxBtc ?? "0.5"} BTC
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Διεύθυνση BTC παράληψης</label>
              <input
                type="text"
                value={destBtc}
                onChange={(e) => setDestBtc(e.target.value)}
                placeholder="bc1q... ή 1..."
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-2">Τρόπος πληρωμής (EUR)</label>
              <div className="grid grid-cols-2 gap-3">
                {(["bank", "card"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={`py-3 rounded-xl text-sm font-medium border transition ${
                      payMethod === m
                        ? "border-amber-500 bg-amber-500/20 text-amber-200"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {m === "bank" ? "🏦 Bank Transfer" : "💳 Card (Stripe)"}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={createOrder}
              disabled={
                loading ||
                !btcAmt ||
                parseFloat(btcAmt) < (rate?.minBtc ?? 0.001) ||
                !destBtc
              }
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-bold py-4 rounded-xl transition"
            >
              {loading ? "Δημιουργία Quote..." : "Λήψη Quote →"}
            </button>
          </div>
        )}

        {step === "confirm" && order && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Επιβεβαίωση και Πληρωμή</h2>
              <div className={`font-mono text-lg font-bold ${
                timer !== null && timer < 120 ? "text-red-400" : "text-amber-300"
              }`}>
                ⏱ {formatTimer(timer)}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
              {[
                { l: "Αγοράζετε", v: `${order.btcAmount} BTC` },
                { l: "Rate κλειδώματος", v: `${order.rateEurPerBtc.toLocaleString("el-GR")} €/BTC` },
                { l: "Τέλος platform", v: `${order.feeEur} €` },
                { l: "Σύνολο πληρωμής", v: `${order.eurAmount} €` },
                { l: "Παράληψη BTC σε", v: order.destinationBtc },
              ].map(({ l, v }) => (
                <div key={l} className="flex justify-between">
                  <span className="text-slate-400">{l}</span>
                  <span className="font-medium font-mono">{v}</span>
                </div>
              ))}
            </div>

            {/* Bank details */}
            {order.paymentMethod === "bank" && order.bankDetails && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
                <div className="font-semibold text-blue-300 mb-3">🏦 Στοιχεία Τραπεζικής Μεταφοράς</div>
                {[
                  { l: "Δικαιούχος",  v: order.bankDetails.beneficiary },
                  { l: "IBAN",       v: order.bankDetails.iban },
                  { l: "Bank",       v: order.bankDetails.bank },
                  { l: "Αιτιολογία",  v: order.paymentRef },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between text-sm">
                    <span className="text-slate-400">{l}</span>
                    <span className="font-mono font-medium text-blue-100">{v}</span>
                  </div>
                ))}
                <div className="text-xs text-blue-300 mt-3 font-medium">
                  ⚠️ Αναγράψτε υποχρεωτικά την αιτιολογία για ταχύτερη εξυπηρέτηση.
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500">
              Ο order λήγει σε {order.quoteTtlMinutes ?? 15} λεπτά. Μετά την πληρωμή το Thronos θα στείλει τα BTC στη διεύθυνση σας.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("form"); setOrder(null); }}
                className="text-slate-400 hover:text-white text-sm transition px-4"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => setStep("done")}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition"
              >
                ✅ Ενημερώθηκα για την πληρωμή
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
            <div className="text-5xl mb-3">⏳</div>
            <h2 className="text-xl font-bold text-green-300">Σε αναμονή επιβεβαίωσης</h2>
            <p className="text-slate-300 text-sm mt-2">
              Μόλις επιβεβαιωθεί η μεταφορά, τα BTC στέλνονται αυτόματα.
            </p>
            <button
              onClick={() => { setStep("form"); setOrder(null); setBtcAmt(""); setDestBtc(""); }}
              className="mt-4 text-sm text-purple-400 hover:text-purple-300 transition"
            >
              Νέα αγορά
            </button>
          </div>
        )}

        {/* Order history */}
        {orders.length > 0 && (
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Ιστορικό Orders</h2>
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                  <div>
                    <div className="font-medium">{o.btcAmount} BTC</div>
                    <div className="text-xs text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString("el-GR")} · ref: {o.paymentRef ?? "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={STATUS_MAP[o.status]?.color ?? "text-white"}>
                      {STATUS_MAP[o.status]?.label ?? o.status}
                    </div>
                    <div className="text-slate-400 text-xs">{o.eurAmount} €</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
