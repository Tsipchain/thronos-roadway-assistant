"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useLocale } from "@/hooks/useLocale";
import type { Translations } from "@/i18n/translations";

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

function formatCountdown(s: number, arrivedNowLabel: string) {
  if (s <= 0) return arrivedNowLabel;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PaymentSection({
  data,
  onPaymentUpdate,
  t,
}: {
  data: RequestData;
  onPaymentUpdate: (p: Payment) => void;
  t: Translations;
}) {
  const [loading, setLoading] = useState(false);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [cryptoTab, setCryptoTab] = useState<"BTC" | "USDT">("BTC");
  const [copied, setCopied] = useState(false);
  const [cryptoConfirmed, setCryptoConfirmed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [redirectCount, setRedirectCount] = useState<number | null>(null);

  const isPaid = data.payment?.status === "COMPLETED";
  const amount = data.finalPrice ?? data.estimatedPrice;
  const isEnterprise = data.tenant.enterpriseEnabled;
  const hasBtc = !!data.tenant.btcAddress;
  const hasEth = !!data.tenant.ethAddress;
  const showStripe = true;

  const isActive = !["COMPLETED", "CANCELLED", "PENDING"].includes(data.status);
  const awaitingCardPayment = data.status === "COMPLETED" && data.payment?.status === "PENDING" && data.payment?.method === "CARD";
  if (!isActive && !isPaid && !awaitingCardPayment) return null;
  if (!amount || amount <= 0) return null;

  // Auto-redirect to Stripe when technician marks job done with CARD
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!awaitingCardPayment || isPaid) return;

    setRedirectCount(5);
    const countInterval = setInterval(() => {
      setRedirectCount((n) => (n !== null && n > 1 ? n - 1 : null));
    }, 1000);

    const redirect = setTimeout(async () => {
      try {
        const res = await fetch(`/api/t/${data.tenant.slug}/jobs/${data.id}/payment-link`, { method: "POST" });
        const json = await res.json();
        if (res.ok && json.url) window.location.href = json.url;
      } catch {}
    }, 5000);

    return () => {
      clearInterval(countInterval);
      clearTimeout(redirect);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingCardPayment, isPaid]);

  const payWithStripe = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/t/${data.tenant.slug}/jobs/${data.id}/payment-link`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t.common_error);
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
    const methodLabel = data.payment!.method === "CASH" ? t.tech_payment_cash : data.payment!.method === "CARD" ? t.tech_payment_card : "Crypto";
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <div className="font-semibold text-green-300">{t.track_paid}</div>
            <div className="text-sm text-slate-400">{data.payment!.amount}€ · {methodLabel}</div>
          </div>
        </div>
      </div>
    );
  }

  // Auto-redirect countdown screen
  if (awaitingCardPayment && redirectCount !== null) {
    return (
      <div className="bg-indigo-500/10 border border-indigo-500/40 rounded-2xl p-6 mb-4 text-center">
        <div className="text-5xl mb-3">💳</div>
        <div className="font-bold text-lg text-indigo-300 mb-1">{t.track_payment_pending}</div>
        <div className="text-slate-400 text-sm mb-4">{t.track_amount_label}: <span className="text-white font-semibold">{amount}€</span></div>
        <div className="text-6xl font-mono font-bold text-indigo-400 mb-4">{redirectCount}</div>
        <button
          onClick={payWithStripe}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition"
        >
          {loading ? `⚙️ ${t.common_loading}` : `💳 ${t.track_pay_now} →`}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
        <h2 className="font-semibold mb-1 text-sm text-slate-300">💳 {t.track_payment_title}</h2>
        <p className="text-xs text-slate-500 mb-4">{t.track_amount_label}: <span className="text-white font-semibold">{amount}€</span>{data.finalPrice ? "" : ` (${t.track_estimated})`}</p>

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
                  <span>{t.track_pay_card}</span>
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
              <span>{t.track_pay_crypto}</span>
            </button>
          )}
        </div>

        {err && <p className="text-red-400 text-xs mt-3">{err}</p>}

        <p className="text-xs text-slate-600 text-center mt-3">
          🔒 {t.track_secure_payment}
        </p>
      </div>

      {/* Crypto modal */}
      {cryptoOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{t.track_pay_crypto}</h3>
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
                  <div className="text-xs text-slate-500 mb-1">{t.track_address}</div>
                  <div className="font-mono text-xs break-all text-slate-200">{currentAddress}</div>
                </div>

                <button
                  onClick={() => copy(currentAddress)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition mb-4"
                >
                  {copied ? `✅ ${t.common_copied}` : `📋 ${t.common_copy}`}
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
                ✅ {t.track_crypto_sent}
              </div>
            ) : (
              <button
                onClick={() => setCryptoConfirmed(true)}
                className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold text-sm transition hover:bg-amber-500/30"
              >
                {t.track_crypto_confirm} →
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
  const { t } = useLocale();

  const STATUS_LABELS: Record<string, string> = {
    PENDING:     t.status_PENDING,
    ACCEPTED:    t.status_ACCEPTED,
    EN_ROUTE:    t.status_EN_ROUTE,
    ARRIVED:     t.status_ARRIVED,
    IN_PROGRESS: t.status_IN_PROGRESS,
    COMPLETED:   t.status_COMPLETED,
    CANCELLED:   t.status_CANCELLED,
  };

  const SERVICE_LABELS: Record<string, string> = {
    BATTERY_REPLACEMENT: t.services.BATTERY_REPLACEMENT,
    BATTERY_CHARGE:      t.services.BATTERY_CHARGE,
    TIRE_CHANGE:         t.services.TIRE_CHANGE,
    TIRE_REPAIR:         t.services.TIRE_REPAIR,
    DIAGNOSIS:           t.services.DIAGNOSIS,
  };

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
    if (data.status === "CANCELLED") return;
    // Keep refreshing if COMPLETED but card payment not yet done
    const paymentDone = !data.payment || data.payment.status === "COMPLETED";
    if (data.status === "COMPLETED" && paymentDone) return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh, data.status, data.payment?.status]);

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
              <p className="text-amber-400 text-xs uppercase tracking-widest mb-1">{t.track_eta_label}</p>
              <div className="text-4xl font-mono font-bold text-amber-300 tabular-nums">
                {formatCountdown(secondsLeft, t.track_arrives_now)}
              </div>
              {data.estimatedMinutes && (
                <p className="text-amber-500/70 text-xs mt-1">~{data.estimatedMinutes} min</p>
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
              {[t.status_PENDING, t.status_ACCEPTED, t.status_EN_ROUTE, t.status_ARRIVED, t.status_IN_PROGRESS, t.status_COMPLETED].map((l) => (
                <span key={l} className="text-xs text-slate-600 text-center" style={{ flex: 1 }}>{l.split(" ")[0]}</span>
              ))}
            </div>
          </div>
        )}

        {/* Job details */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <h2 className="font-semibold mb-4 text-sm text-slate-300">{t.track_job_details}</h2>
          <div className="space-y-3 text-sm">
            <Row label={t.track_service} value={SERVICE_LABELS[data.serviceType] ?? data.serviceType} />
            <Row label={t.track_vehicle} value={`${data.vehicle.make} ${data.vehicle.model}`} />
            <Row label={t.track_license_plate} value={<span className="font-mono">{data.vehicle.licensePlate}</span>} />
            {data.estimatedPrice != null && !data.finalPrice && (
              <Row label={t.track_estimated} value={<span className="text-purple-300 font-semibold">{data.estimatedPrice}€</span>} />
            )}
            {data.finalPrice != null && (
              <Row label={t.track_final_cost} value={<span className="text-green-300 font-semibold">{data.finalPrice}€</span>} />
            )}
          </div>
        </div>

        {/* Payment */}
        <PaymentSection
          data={data}
          onPaymentUpdate={(p) => setData((prev) => ({ ...prev, payment: p }))}
          t={t}
        />

        {/* Technician */}
        {data.technician && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <h2 className="font-semibold mb-3 text-sm text-slate-300">{t.track_technician}</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{data.technician.name}</div>
                <div className="text-sm text-slate-400">{data.technician.phone}</div>
              </div>
              {data.technician.phone && (
                <a href={`tel:${data.technician.phone}`}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
                  📞 {t.track_call_tech}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Company contact */}
        {data.tenant?.phone && (
          <div className="text-center mb-4">
            <p className="text-slate-500 text-sm">{t.track_need_help}</p>
            <a href={`tel:${data.tenant.phone}`} className="text-blue-400 hover:text-blue-300 text-sm">
              📞 {data.tenant.name}: {data.tenant.phone}
            </a>
          </div>
        )}

        {!isCompleted && !isCancelled && (
          <div className="text-center mb-4">
            <button onClick={refresh} className="text-slate-500 hover:text-slate-300 text-xs transition">
              ↻ {t.track_refresh}
            </button>
            <p className="text-slate-700 text-xs mt-1">
              {t.track_auto_refresh}{" "}
              {lastRefresh.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          </div>
        )}

        <div className="text-center">
          <Link href={`/t/${data.tenant.slug}`} className="text-slate-600 hover:text-slate-400 text-sm transition">
            ← {t.track_new_request}
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
