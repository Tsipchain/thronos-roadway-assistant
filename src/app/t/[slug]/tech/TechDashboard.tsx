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
  EN_ROUTE:    "📍 Έφτασα",
  ARRIVED:     "🔧 Ξεκινώ",
  IN_PROGRESS: "✅ Ολοκλήρωσα",
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
}: Props) {
  const router = useRouter();
  const [jobs, setJobs]               = useState<Job[]>(activeJobs);
  const [isOnline, setIsOnline]       = useState(techProfile?.isOnline ?? false);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [togglingOnline, setToggling] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [newJobAlert, setNewJobAlert] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [myLoc, setMyLoc]             = useState<{ lat: number; lng: number } | null>(null);
  const prevCountRef = useRef(activeJobs.length);

  // ETA confirm state (before EN_ROUTE)
  const [etaConfirm, setEtaConfirm] = useState<{ job: Job; eta: number } | null>(null);

  // Auto-refresh server data every 30s
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Sync jobs from server
  useEffect(() => {
    setJobs(activeJobs);
    if (activeJobs.length > prevCountRef.current) {
      setNewJobAlert(true);
      setTimeout(() => setNewJobAlert(false), 6000);
    }
    prevCountRef.current = activeJobs.length;
  }, [activeJobs]);

  // GPS location tracking — send to server every 60s when online
  useEffect(() => {
    if (!isOnline || !navigator?.geolocation) return;
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMyLoc({ lat: latitude, lng: longitude });
          fetch("/api/tech/location", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude, longitude }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    send();
    const id = setInterval(send, 60_000);
    return () => clearInterval(id);
  }, [isOnline]);

  const updateStatus = async (requestId: string, newStatus: string, newEta?: number) => {
    setUpdatingId(requestId);
    setError(null);
    try {
      const res = await fetch(`/api/tech/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newEta != null ? { estimatedMinutes: newEta } : {}),
        }),
      });
      if (!res.ok) throw new Error("Σφάλμα ενημέρωσης");
      if (newStatus === "COMPLETED") {
        setJobs((prev) => prev.filter((j) => j.id !== requestId));
      } else {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === requestId
              ? { ...j, status: newStatus, ...(newEta != null ? { estimatedMinutes: newEta } : {}) }
              : j
          )
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAction = (job: Job) => {
    const next = NEXT_STATUS[job.status];
    if (!next) return;
    // Show ETA confirm modal before going EN_ROUTE
    if (next === "EN_ROUTE") {
      const distKm = myLoc ? haversineKm(myLoc.lat, myLoc.lng, job.latitude, job.longitude) : null;
      const suggestedEta = distKm != null
        ? Math.max(5, Math.round(distKm * 3 / 5) * 5)
        : (job.estimatedMinutes ?? 30);
      setEtaConfirm({ job, eta: suggestedEta });
      return;
    }
    updateStatus(job.id, next);
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
              <p className="text-slate-500 text-xs">
                Τεχνικός
                {myLoc && <span className="text-green-600 ml-1">· GPS ✓</span>}
              </p>
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
              {jobs.map((job) => {
                const distKm = myLoc
                  ? haversineKm(myLoc.lat, myLoc.lng, job.latitude, job.longitude)
                  : null;
                return (
                  <div key={job.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="font-semibold">{job.customer.name}</div>
                        <a href={`tel:${job.customer.phone}`} className="text-sm text-blue-400 hover:text-blue-300">
                          📞 {job.customer.phone}
                        </a>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-medium ${
                        STATUS_COLORS[job.status] ?? "bg-white/10 text-white"
                      }`}>
                        {STATUS_LABELS[job.status] ?? job.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-slate-300 mb-3">
                      <div>🚗 {job.vehicle.make} {job.vehicle.model} · <span className="font-mono">{job.vehicle.licensePlate}</span></div>
                      <div>🔧 {SERVICE_LABELS[job.serviceType] ?? job.serviceType}</div>
                      {job.address && <div>📍 {job.address}</div>}
                      {job.status === "ACCEPTED" && (
                        <div className="flex items-center gap-3">
                          {job.estimatedMinutes != null && (
                            <span className="text-cyan-300">⏱ ETA admin: {job.estimatedMinutes} λεπτ.</span>
                          )}
                          {distKm != null && (
                            <span className="text-slate-400">📏 {distKm.toFixed(1)} km από σας</span>
                          )}
                        </div>
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
                          onClick={() => handleAction(job)}
                          disabled={updatingId === job.id}
                          className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                        >
                          {updatingId === job.id
                            ? "..."
                            : job.status === "ACCEPTED"
                            ? "🚗 Εκκινώ"
                            : (NEXT_LABEL[job.status] ?? "Επόμενο")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending unassigned */}
        {pendingJobs.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold mb-3 text-sm text-slate-400">
              Αναμονή Ανάθεσης ({pendingJobs.length})
            </h2>
            <div className="space-y-2">
              {pendingJobs.map((job) => (
                <div key={job.id} className="bg-white/3 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{SERVICE_LABELS[job.serviceType] ?? job.serviceType}</div>
                    <div className="text-xs text-slate-500">
                      {job.address ?? `${job.latitude.toFixed(3)}, ${job.longitude.toFixed(3)}`}
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 shrink-0">
                    {new Date(job.createdAt).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
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

      {/* ETA confirm modal — shown when tech presses Εκκινώ */}
      {etaConfirm && (() => {
        const { job, eta } = etaConfirm;
        const distKm = myLoc
          ? haversineKm(myLoc.lat, myLoc.lng, job.latitude, job.longitude)
          : null;
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold mb-1">Επιβεβαίωση Εκκίνησης</h3>
              <p className="text-slate-400 text-sm mb-5">
                {job.customer.name} · {job.address ?? `${job.latitude.toFixed(4)}, ${job.longitude.toFixed(4)}`}
              </p>

              {(distKm != null || job.estimatedMinutes != null) && (
                <div className="bg-slate-800 rounded-xl p-3 mb-5 flex gap-4 text-sm">
                  {distKm != null && (
                    <div className="text-center flex-1">
                      <div className="text-lg font-bold text-blue-300">{distKm.toFixed(1)} km</div>
                      <div className="text-slate-500 text-xs">Απόσταση</div>
                    </div>
                  )}
                  {job.estimatedMinutes != null && (
                    <div className="text-center flex-1">
                      <div className="text-lg font-bold text-slate-400">{job.estimatedMinutes} λεπτ.</div>
                      <div className="text-slate-500 text-xs">ETA admin</div>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Εκτίμησέ σου (λεπτά)</div>
                <div className="flex items-center gap-3 justify-center">
                  <button
                    onClick={() => setEtaConfirm((p) => p ? { ...p, eta: Math.max(5, p.eta - 5) } : p)}
                    className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-xl font-bold transition"
                  >
                    −
                  </button>
                  <div className="text-4xl font-bold text-purple-300 w-24 text-center">
                    {eta}
                  </div>
                  <button
                    onClick={() => setEtaConfirm((p) => p ? { ...p, eta: Math.min(180, p.eta + 5) } : p)}
                    className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-xl font-bold transition"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEtaConfirm(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition text-sm"
                >
                  Ακύρωση
                </button>
                <button
                  onClick={() => {
                    updateStatus(job.id, "EN_ROUTE", eta);
                    setEtaConfirm(null);
                  }}
                  disabled={updatingId === job.id}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold transition text-sm"
                >
                  🚗 Εκκινώ →
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
