"use client";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  PENDING:     "Εκκρεμεί",
  ACCEPTED:    "Αποδεκτό",
  EN_ROUTE:    "Σε δρόμο",
  ARRIVED:     "Έφτασα",
  IN_PROGRESS: "Εκτελείται",
  COMPLETED:   "Ολοκληρώθηκε",
  CANCELLED:   "Ακυρώθηκε",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-amber-500/20 text-amber-300",
  ACCEPTED:    "bg-blue-500/20 text-blue-300",
  EN_ROUTE:    "bg-cyan-500/20 text-cyan-300",
  ARRIVED:     "bg-indigo-500/20 text-indigo-300",
  IN_PROGRESS: "bg-purple-500/20 text-purple-300",
  COMPLETED:   "bg-green-500/20 text-green-300",
  CANCELLED:   "bg-red-500/20 text-red-300",
};

const SERVICE_LABELS: Record<string, string> = {
  BATTERY_REPLACEMENT: "Αντικ. Μπαταρίας",
  BATTERY_CHARGE:      "Φόρτιση Μπαταρίας",
  TIRE_CHANGE:         "Αλλαγή Λάστιχου",
  TIRE_REPAIR:         "Επισκευή Λάστιχου",
  DIAGNOSIS:           "Διάγνωση",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING:     "ACCEPTED",
  ACCEPTED:    "EN_ROUTE",
  EN_ROUTE:    "ARRIVED",
  ARRIVED:     "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED:   null,
  CANCELLED:   null,
};

const NEXT_LABEL: Record<string, string> = {
  PENDING:     "✓ Δέχομαι",
  ACCEPTED:    "🚗 Εκκινώ",
  EN_ROUTE:    "📍 Έφτασα",
  ARRIVED:     "🔧 Ξεκινώ",
  IN_PROGRESS: "✅ Ολοκλήρωσα",
};

interface Job {
  id: string;
  status: string;
  serviceType: string;
  latitude: number;
  longitude: number;
  address: string | null;
  estimatedPrice: number | null;
  estimatedMinutes: number | null;
  customer: { name: string; phone: string };
  vehicle: { licensePlate: string; make: string; model: string };
  createdAt: string;
  acceptedAt: string | null;
}

interface TechProfile {
  id: string;
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  totalJobs: number;
}

interface Props {
  techProfile: TechProfile | null;
  activeJobs: Job[];
  pendingJobs: Job[];
  completedTotal: number;
  userName: string;
  slug: string;
}

export default function TechDashboard({
  techProfile,
  activeJobs,
  pendingJobs,
  completedTotal,
  userName,
  slug,
}: Props) {
  const router = useRouter();
  const [jobs, setJobs]                   = useState<Job[]>(activeJobs);
  const [isOnline, setIsOnline]           = useState(techProfile?.isOnline ?? false);
  const [updatingId, setUpdatingId]       = useState<string | null>(null);
  const [togglingOnline, setToggling]     = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [newJobAlert, setNewJobAlert]     = useState(false);
  const [lastRefresh, setLastRefresh]     = useState(new Date());
  const prevCountRef                      = useRef(activeJobs.length);

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    setJobs(activeJobs);
    if (activeJobs.length > prevCountRef.current) {
      setNewJobAlert(true);
      setTimeout(() => setNewJobAlert(false), 6000);
    }
    prevCountRef.current = activeJobs.length;
  }, [activeJobs]);

  const updateStatus = async (requestId: string, newStatus: string) => {
    setUpdatingId(requestId);
    setError(null);
    try {
      const res = await fetch(`/api/tech/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Σφάλμα ενημέρωσης");
      if (newStatus === "COMPLETED") {
        setJobs((prev) => prev.filter((j) => j.id !== requestId));
      } else {
        setJobs((prev) =>
          prev.map((j) => (j.id === requestId ? { ...j, status: newStatus } : j))
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleOnline = async () => {
    setToggling(true);
    try {
      await fetch("/api/tech/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: !isOnline }),
      });
      setIsOnline((v) => !v);
    } catch {}
    finally { setToggling(false); }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-6">
      <div className="max-w-lg mx-auto">

        {/* New job alert */}
        {newJobAlert && (
          <div className="mb-4 bg-purple-500/20 border border-purple-500/40 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
            <span className="text-2xl">🔔</span>
            <div>
              <div className="font-semibold text-purple-300">Νέο Job ανατέθηκε!</div>
              <div className="text-xs text-slate-400">Ελέγξτε τα Ανατεθειμένα παρακάτω</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-amber-900/30">
              🔧
            </div>
            <div>
              <h1 className="font-bold text-base">{userName}</h1>
              <p className="text-slate-500 text-xs">Τεχνικός</p>
            </div>
          </div>
          <button
            onClick={toggleOnline}
            disabled={togglingOnline}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
              isOnline
                ? "bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30"
                : "bg-slate-800 border-white/10 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {togglingOnline ? "..." : isOnline ? "● Online" : "○ Offline"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{jobs.length}</div>
            <div className="text-slate-500 text-xs mt-1">Ενεργά</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{completedTotal}</div>
            <div className="text-slate-500 text-xs mt-1">Σύνολο</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {techProfile?.rating.toFixed(1) ?? "—"}
            </div>
            <div className="text-slate-500 text-xs mt-1">Rating ⭐</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* Active Jobs */}
        <div className="mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Ανατεθειμένα ({jobs.length})
          </h2>
          {jobs.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-slate-500">
              <div className="text-3xl mb-2">😴</div>
              <p className="text-sm">Δεν υπάρχουν ενεργά jobs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="font-semibold">{job.customer.name}</div>
                      <a
                        href={`tel:${job.customer.phone}`}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        📞 {job.customer.phone}
                      </a>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-medium ${
                        STATUS_COLORS[job.status] ?? "bg-white/10 text-white"
                      }`}
                    >
                      {STATUS_LABELS[job.status] ?? job.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-300 mb-3">
                    <div>🚗 {job.vehicle.make} {job.vehicle.model} · <span className="font-mono">{job.vehicle.licensePlate}</span></div>
                    <div>🔧 {SERVICE_LABELS[job.serviceType] ?? job.serviceType}</div>
                    {job.address && <div>📍 {job.address}</div>}
                    {job.status === "ACCEPTED" && job.estimatedMinutes != null && (
                      <div className="text-cyan-300 font-medium">⏱ Εκτ. άφιξη: {job.estimatedMinutes} λεπτ.</div>
                    )}
                    {job.estimatedPrice != null && (
                      <div className="text-purple-300 font-medium">💰 {job.estimatedPrice}€</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={`https://maps.google.com/?q=${job.latitude},${job.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-700/30 hover:bg-blue-700/50 text-blue-300 text-sm font-medium py-2.5 rounded-xl transition text-center"
                    >
                      🗺️ Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${job.latitude},${job.longitude}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-cyan-700/30 hover:bg-cyan-700/50 text-cyan-300 text-sm font-medium py-2.5 rounded-xl transition text-center"
                    >
                      🚗 Waze
                    </a>
                    {NEXT_STATUS[job.status] && (
                      <button
                        onClick={() => updateStatus(job.id, NEXT_STATUS[job.status]!)}
                        disabled={updatingId === job.id}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                      >
                        {updatingId === job.id ? "..." : (NEXT_LABEL[job.status] ?? "Επόμενο")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending (unassigned) jobs in area */}
        {pendingJobs.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold mb-3 text-sm text-slate-400">
              Αναμονή Ανάθεσης ({pendingJobs.length})
            </h2>
            <div className="space-y-2">
              {pendingJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white/3 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {SERVICE_LABELS[job.serviceType] ?? job.serviceType}
                    </div>
                    <div className="text-xs text-slate-500">
                      {job.address ?? `${job.latitude.toFixed(3)}, ${job.longitude.toFixed(3)}`}
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0">
                    {new Date(job.createdAt).toLocaleTimeString("el-GR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8 space-y-2">
          <p className="text-slate-700 text-xs">
            Τελ. ανανέωση: {lastRefresh.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-600 hover:text-slate-400 text-xs transition"
          >
            Αποσύνδεση
          </button>
        </div>
      </div>
    </main>
  );
}
