"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  tenant: { name: string; phone: string | null; slug: string };
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Φθάνει τώρα";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TrackingClient({ initial }: { initial: RequestData }) {
  const router = useRouter();
  const [data, setData] = useState<RequestData>(initial);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const showCountdown =
    (data.status === "ACCEPTED" || data.status === "EN_ROUTE") &&
    data.estimatedMinutes != null &&
    data.acceptedAt != null;

  // Compute and tick countdown
  useEffect(() => {
    if (!showCountdown) {
      setSecondsLeft(null);
      return;
    }
    const accepted = new Date(data.acceptedAt!).getTime();
    const totalSeconds = data.estimatedMinutes! * 60;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - accepted) / 1000);
      setSecondsLeft(Math.max(0, totalSeconds - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showCountdown, data.acceptedAt, data.estimatedMinutes]);

  // Auto-refresh status every 30s (unless terminal state)
  useEffect(() => {
    const isTerminal = data.status === "COMPLETED" || data.status === "CANCELLED";
    if (isTerminal) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/track/${data.id}`);
        if (res.ok) {
          const updated: RequestData = await res.json();
          setData(updated);
          setLastRefresh(new Date());
        }
      } catch {/* silent */}
    }, 30_000);
    return () => clearInterval(id);
  }, [data.id, data.status]);

  const isCancelled = data.status === "CANCELLED";
  const isCompleted = data.status === "COMPLETED";
  const statusIndex = STATUS_ORDER.indexOf(data.status);

  const manualRefresh = async () => {
    try {
      const res = await fetch(`/api/track/${data.id}`);
      if (res.ok) {
        const updated: RequestData = await res.json();
        setData(updated);
        setLastRefresh(new Date());
      }
    } catch {/* silent */}
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-md mx-auto">

        {/* Status Hero */}
        <div className="text-center py-8 mb-6">
          <div className="text-6xl mb-3">{STATUS_ICONS[data.status] ?? "📋"}</div>
          <h1 className="text-2xl font-bold">{STATUS_LABELS[data.status] ?? data.status}</h1>
          <p className="text-slate-400 text-sm mt-1">{data.tenant?.name}</p>

          {/* Countdown Timer */}
          {showCountdown && secondsLeft !== null && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-amber-400 text-xs uppercase tracking-widest mb-1">Εκτιμώμενος χρόνος άφιξης</p>
              <div className="text-4xl font-mono font-bold text-amber-300 tabular-nums">
                {secondsLeft <= 0 ? "Φθάνει τώρα" : formatCountdown(secondsLeft)}
              </div>
              {data.estimatedMinutes && (
                <p className="text-amber-500/70 text-xs mt-1">~{data.estimatedMinutes} λεπτά συνολικά</p>
              )}
            </div>
          )}

          {/* Static ETA when no acceptedAt timestamp yet */}
          {data.estimatedMinutes && !showCountdown && !isCompleted && !isCancelled && (
            <p className="text-amber-400 text-sm mt-2 font-medium">
              εκτ. άφιξη: ~{data.estimatedMinutes} λεπτά
            </p>
          )}
        </div>

        {/* Progress Steps */}
        {!isCancelled && (
          <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              {STATUS_ORDER.map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      i < statusIndex
                        ? "bg-purple-600 text-white"
                        : i === statusIndex
                        ? "bg-purple-500 text-white ring-2 ring-purple-400/50"
                        : "bg-slate-800 text-slate-600"
                    }`}
                  >
                    {i < statusIndex ? "✓" : i + 1}
                  </div>
                  {i < STATUS_ORDER.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 transition-all ${
                        i < statusIndex ? "bg-purple-600" : "bg-slate-800"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {["Αναμονή", "Ανάθεση", "Δρόμο", "Άφιξη", "Επισκευή", "Τέλος"].map((l) => (
                <span key={l} className="text-xs text-slate-600 text-center" style={{ flex: 1 }}>
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Request Details */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <h2 className="font-semibold mb-4 text-sm text-slate-300">Λεπτομέρειες</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Υπηρεσία</span>
              <span className="font-medium">{SERVICE_LABELS[data.serviceType] ?? data.serviceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Όχημα</span>
              <span>{data.vehicle.make} {data.vehicle.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Πινακίδα</span>
              <span className="font-mono">{data.vehicle.licensePlate}</span>
            </div>
            {data.estimatedPrice != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Εκτίμηση</span>
                <span className="text-purple-300 font-semibold">{data.estimatedPrice}€</span>
              </div>
            )}
            {data.finalPrice != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Τελικό Κόστος</span>
                <span className="text-green-300 font-semibold">{data.finalPrice}€</span>
              </div>
            )}
          </div>
        </div>

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
                <a
                  href={`tel:${data.technician.phone}`}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
                >
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
            <button
              onClick={manualRefresh}
              className="text-slate-500 hover:text-slate-300 text-xs transition"
            >
              ↻ Ανανέωση κατάστασης
            </button>
            <p className="text-slate-700 text-xs mt-1">
              Αυτόματη ανανέωση κάθε 30"· τελευταία: {lastRefresh.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
