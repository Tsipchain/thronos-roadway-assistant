"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  PENDING:     "Αναζήτηση Τεχνικού...",
  ACCEPTED:    "Τεχνικός Ανατέθηκε",
  EN_ROUTE:    "Ο Τεχνικός Έρχεται",
  ARRIVED:     "Ο Τεχνικός Έφτασε",
  IN_PROGRESS: "Εκτελείται η Επισκευή",
  COMPLETED:   "Ολοκληρώθηκε!",
  CANCELLED:   "Ακυρώθηκε",
};

const STATUS_ICONS: Record<string, string> = {
  PENDING:     "🔍",
  ACCEPTED:    "✅",
  EN_ROUTE:    "🚗",
  ARRIVED:     "📍",
  IN_PROGRESS: "🔧",
  COMPLETED:   "🎉",
  CANCELLED:   "❌",
};

const STATUS_ORDER = ["PENDING", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "COMPLETED"];

const SERVICE_LABELS: Record<string, string> = {
  BATTERY_REPLACEMENT: "Αντικατάσταση Μπαταρίας",
  BATTERY_CHARGE:      "Φόρτιση Μπαταρίας",
  TIRE_CHANGE:         "Αλλαγή Λάστιχου",
  TIRE_REPAIR:         "Επισκευή Λάστιχου",
  DIAGNOSIS:           "Διάγνωση",
};

type Payment = { status: string; method: string; amount: number } | null;

type RequestData = {
  id: string;
  status: string;
  serviceType: string;
  estimatedMinutes: number | null;
  estimatedPrice: number | null;
  finalPrice: number | null;
  acceptedAt: string | null;
  technician: { name: string; phone: string | null } | null;
  vehicle: { licensePlate: string; make: string; model: string };
  tenant: {
    name: string;
    phone: string | null;
    slug: string;
    btcAddress: string | null;
    ethAddress: string | null;
    enterpriseEnabled: boolean;
  };
  payment: Payment;
};

function formatCountdown(s: number) {
  if (s <= 0) return "Φθάνει τώρα";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PaymentSection({
  data,
  onPaymentUpdate,
}: {
  data: RequestData;
  onPaymentUpdate: (p: Payment) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [cryptoTab, setCryptoTab] = useState<"BTC" | "USDT">("BTC");
  const [copied, setCopied] = useState(false);
  const [cryptoConfirmed, setCryptoConfirmed] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isPaid = data.payment?.status === "COMPLETED";
  const amount = data.finalPrice ?? data.estimatedPrice;
  const isEnterprise = data.tenant.enterpriseEnabled;
  const hasBtc = !!data.tenant.btcAddress;
  const hasEth = !!data.tenant.ethAddress;
  const showStripe = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    // fallback: always show Stripe button (API will return error if not configured)
    true;

  const isActive = !["COMPLETED", "CANCELLED", "PENDING"].includes(data.status);
  if (!isActive && !isPaid) return null;
  if (!amount || amount <= 0) return null;

  const payWithStripe = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/t/${data.tenant.slug}/jobs/${data.id}/payment-link`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Σφάλμα");
      window.location.href = json.url;
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const btcApprox = amount ? (amount / 95000).toFixed(6) : "—";
  const currentAddress = cryptoTab === "BTC" ? data.tenant.btcAddress : data.tenant.ethAddress;
  const qrData =
    cryptoTab === "BTC" && data.tenant.btcAddress
      ? `bitcoin:${data.tenant.btcAddress}?amount=${btcApprox}`
      : (data.tenant.ethAddress ?? "");

  if (isPaid) {
    const methodLabel = data.payment!.method === "CASH" ? "Μετρητά" : data.payment!.method === "CARD" ? "Κάρτα" : "Crypto";
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <div className="font-semibold text-green-300">Πληρώθηκε</div>
            <div className="text-sm text-slate-400">{data.payment!.amount}€ · {methodLabel}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
        <h2 className="font-semibold mb-1 text-sm text-slate-300">💳 Πληρωμή</h2>
        <p className="text-xs text-slate-500 mb-4">Ποσό: <span className="text-white font-semibold">{amount}€</span>{data.finalPrice ? "" : " (κατ. εκτίμηση)"}</p>

        <div className="space-y-3">
          {/* Stripe */}
          {showStripe && (
            <button
              onClick={payWithStripe}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-spin">⚙️</span>
              ) : (
                <>
                  <span className="text-xl">💳</span>
                  <span>Πληρώστε με Κάρτα (Stripe)</span>
                </>
              )}
            </button>
          )}

          {/* Crypto — Enterprise only */}
          {isEnterprise && (hasBtc || hasEth) && (
            <button
              onClick={() => setCryptoOpen(true)}
              className="w-full py-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 font-semibold transition flex items-center justify-center gap-2"
            >
              <span className="text-xl">₿</span>
              <span>Πληρώστε με Crypto (BTC / USDT / USDC)</span>
            </button>
          )}
        </div>

        {err && <p className="text-red-400 text-xs mt-3">{err}</p>}

        <p className="text-xs text-slate-600 text-center mt-3">
          🔒 Ασφαλής πληρωμή μέσω Stripe · Powered by Thronos Chain
        </p>
      </div>

      {/* Crypto modal */}
      {cryptoOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Πληρωμή με Crypto</h3>
              <button onClick={() => setCryptoOpen(false)} className="text-slate-500 hover:text-white text-xl">×</button>
            </div>

            {/* Amount */}
            <div className="bg-slate-800 rounded-xl p-3 mb-4 text-center">
              <div className="text-2xl font-bold text-amber-300">{amount}€</div>
              {cryptoTab === "BTC" && (
                <div className="text-xs text-slate-500 mt-0.5">≈ {btcApprox} BTC</div>
              )}
              {cryptoTab === "USDT" && (
                <div className="text-xs text-slate-500 mt-0.5">≈ {amount} USDT</div>
              )}
            </div>

            {/* Chain tabs */}
            <div className="flex gap-2 mb-4">
              {hasBtc && (
                <button
                  onClick={() => setCryptoTab("BTC")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${
                    cryptoTab === "BTC"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "bg-white/5 border-white/10 text-slate-400"
                  }`}
                >
                  ₿ Bitcoin
                </button>
              )}
              {hasEth && (
                <button
                  onClick={() => setCryptoTab("USDT")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${
                    cryptoTab === "USDT"
                      ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                      : "bg-white/5 border-white/10 text-slate-400"
                  }`}
                >
                  ◎ USDT / USDC
                </button>
              )}
            </div>

            {/* QR Code */}
            {currentAddress && (
              <>
                <div className="flex justify-center mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=ffffff&bgcolor=0f172a&data=${encodeURIComponent(qrData)}`}
                    alt="QR Code"
                    width={180}
                    height={180}
                    className="rounded-xl border border-white/10"
                  />
                </div>

                <div className="bg-slate-800 rounded-xl p-3 mb-3">
                  <div className="text-xs text-slate-500 mb-1">Διεύθυνση</div>
                  <div className="font-mono text-xs break-all text-slate-200">{currentAddress}</div>
                </div>

                <button
                  onClick={() => copy(currentAddress)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition mb-4"
                >
                  {copied ? "✅ Αντιγράφηκε!" : "📋 Αντιγραφή Διεύθυνσης"}
                </button>
              </>
            )}

            {/* Thronos Chain branding */}
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-4 text-xs text-slate-400">
              <span className="text-purple-400 font-medium">⚡ Enterprise · Thronos Chain</span>
              <br />
              Η πληρωμή ρευστεί αυτόματα στο
              main liquidity pool. Μέρος της αμοιβής αποδίδεται στον
              τεχνικό ως THR αμοιβή.
            </div>

            {cryptoConfirmed ? (
              <div className="text-center text-green-400 text-sm py-2">
                ✅ Ευχαριστούμε! Ο τεχνικός θα επιβεβαιώσει την απόδειξη.
              </div>
            ) : (
              <button
                onClick={() => setCryptoConfirmed(true)}
                className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold text-sm transition hover:bg-amber-500/30"
              >
                Απέστειλα την πληρωμή →
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function TrackingClient({ initial }: { initial: RequestData }) {
  const [data, setData]         = useState<RequestData>(initial);
  const [secondsLeft, setSecs]  = useState<number | null>(null);
  const [lastRefresh, setRefresh] = useState(new Date());

  const showCountdown =
    (data.status === "ACCEPTED" || data.status === "EN_ROUTE") &&
    data.estimatedMinutes != null &&
    data.acceptedAt != null;

  useEffect(() => {
    if (!showCountdown) { setSecs(null); return; }
    const accepted = new Date(data.acceptedAt!).getTime();
    const total = data.estimatedMinutes! * 60;
    const tick = () => setSecs(Math.max(0, total - Math.floor((Date.now() - accepted) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showCountdown, data.acceptedAt, data.estimatedMinutes]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${data.id}`);
      if (res.ok) { setData(await res.json()); setRefresh(new Date()); }
    } catch {/* silent */}
  }, [data.id]);

  useEffect(() => {
    if (data.status === "COMPLETED" || data.status === "CANCELLED") return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh, data.status]);

  const isCancelled = data.status === "CANCELLED";
  const isCompleted = data.status === "COMPLETED";
  const statusIndex = STATUS_ORDER.indexOf(data.status);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-md mx-auto">

        {/* Status Hero */}
        <div className="text-center py-8 mb-6">
          <div className="text-6xl mb-3">{STATUS_ICONS[data.status] ?? "📋"}</div>
          <h1 className="text-2xl font-bold">{STATUS_LABELS[data.status] ?? data.status}</h1>
          <p className="text-slate-400 text-sm mt-1">{data.tenant?.name}</p>

          {showCountdown && secondsLeft !== null && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-amber-400 text-xs uppercase tracking-widest mb-1">Εκτιμώμενος χρόνος άφιξης</p>
              <div className="text-4xl font-mono font-bold text-amber-300 tabular-nums">
                {formatCountdown(secondsLeft)}
              </div>
              {data.estimatedMinutes && (
                <p className="text-amber-500/70 text-xs mt-1">~{data.estimatedMinutes} λεπτά συνολικά</p>
              )}
            </div>
          )}
        </div>

        {/* Progress Steps */}
        {!isCancelled && (
          <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              {STATUS_ORDER.map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    i < statusIndex  ? "bg-purple-600 text-white"
                    : i === statusIndex ? "bg-purple-500 text-white ring-2 ring-purple-400/50"
                    : "bg-slate-800 text-slate-600"
                  }`}>
                    {i < statusIndex ? "✓" : i + 1}
                  </div>
                  {i < STATUS_ORDER.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${ i < statusIndex ? "bg-purple-600" : "bg-slate-800" }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {["Αναμονή", "Ανάθεση", "Δρόμο", "Άφιξη", "Επισκευή", "Τέλος"].map((l) => (
                <span key={l} className="text-xs text-slate-600 text-center" style={{ flex: 1 }}>{l}</span>
              ))}
            </div>
          </div>
        )}

        {/* Job details */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <h2 className="font-semibold mb-4 text-sm text-slate-300">Λεπτομέρειες</h2>
          <div className="space-y-3 text-sm">
            <Row label="Υπηρεσία" value={SERVICE_LABELS[data.serviceType] ?? data.serviceType} />
            <Row label="Όχημα" value={`${data.vehicle.make} ${data.vehicle.model}`} />
            <Row label="Πινακίδα" value={<span className="font-mono">{data.vehicle.licensePlate}</span>} />
            {data.estimatedPrice != null && !data.finalPrice && (
              <Row label="Εκτίμηση" value={<span className="text-purple-300 font-semibold">{data.estimatedPrice}€</span>} />
            )}
            {data.finalPrice != null && (
              <Row label="Τελικό Κόστος" value={<span className="text-green-300 font-semibold">{data.finalPrice}€</span>} />
            )}
          </div>
        </div>

        {/* Payment */}
        <PaymentSection
          data={data}
          onPaymentUpdate={(p) => setData((prev) => ({ ...prev, payment: p }))}
        />

        {/* Technician */}
        {data.technician && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <h2 className="font-semibold mb-3 text-sm text-slate-300">Τεχνικός</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{data.technician.name}</div>
                <div className="text-sm text-slate-400">{data.technician.phone}</div>
              </div>
              {data.technician.phone && (
                <a href={`tel:${data.technician.phone}`}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
                  📞 Κλήση
                </a>
              )}
            </div>
          </div>
        )}

        {/* Company contact */}
        {data.tenant?.phone && (
          <div className="text-center mb-4">
            <p className="text-slate-500 text-sm">Χρειάζεστε βοήθεια;</p>
            <a href={`tel:${data.tenant.phone}`} className="text-blue-400 hover:text-blue-300 text-sm">
              📞 {data.tenant.name}: {data.tenant.phone}
            </a>
          </div>
        )}

        {!isCompleted && !isCancelled && (
          <div className="text-center mb-4">
            <button onClick={refresh} className="text-slate-500 hover:text-slate-300 text-xs transition">
              ↻ Ανανέωση κατάστασης
            </button>
            <p className="text-slate-700 text-xs mt-1">
              Αυτόματη ανανέωση κάθε 30"· τελευταία:{" "}
              {lastRefresh.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        )}

        <div className="text-center">
          <Link href={`/t/${data.tenant.slug}`} className="text-slate-600 hover:text-slate-400 text-sm transition">
            ← Νέο Αίτημα
          </Link>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}
