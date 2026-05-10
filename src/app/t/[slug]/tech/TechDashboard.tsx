"use client";
import { useState, useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

// Extend Window for beforeinstallprompt event
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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

const BATTERY_TIERS = [
  { ah: 45, label: "45Ah", sublabel: "Τυπική",      surcharge: 0  },
  { ah: 55, label: "55Ah", sublabel: "Ενισχυμένη", surcharge: 10 },
  { ah: 65, label: "65Ah", sublabel: "Premium",      surcharge: 20 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

type EtaConfirm = { job: Job; eta: number };
type CompleteConfirm = {
  job: Job;
  batteryAh: number | null;
  batteryBrand: string;
  paymentMethod: "CASH" | "CARD";
  finalPrice: number;
  notes: string;
};

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
  const prevCountRef                  = useRef(activeJobs.length);

  const [etaConfirm, setEtaConfirm]           = useState<EtaConfirm | null>(null);
  const [completeConfirm, setCompleteConfirm] = useState<CompleteConfirm | null>(null);
  const [paymentLink, setPaymentLink]         = useState<string | null>(null);
  const [linkCopied, setLinkCopied]           = useState(false);
  const [installPrompt, setInstallPrompt]     = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled]         = useState(false);
  const [showIosHint, setShowIosHint]         = useState(false);

  useEffect(() => {
    const id = setInterval(() => { router.refresh(); setLastRefresh(new Date()); }, 30_000);
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

  useEffect(() => {
    if (!isOnline || !navigator?.geolocation) return;
    const send = () => navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setMyLoc({ lat: coords.latitude, lng: coords.longitude });
        fetch("/api/tech/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
    send();
    const id = setInterval(send, 60_000);
    return () => clearInterval(id);
  }, [isOnline]);

  // PWA install detection
  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Android Chrome: capture the install prompt
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detection — no beforeinstallprompt, show manual hint
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInBrowser = !window.matchMedia("(display-mode: standalone)").matches;
    if (isIos && isInBrowser) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  const updateStatus = async (
    requestId: string,
    newStatus: string,
    extra?: Record<string, unknown>
  ) => {
    setUpdatingId(requestId);
    setError(null);
    try {
      const res = await fetch(`/api/tech/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      if (!res.ok) throw new Error("Σφάλμα ενημέρωσης");
      const resData = await res.json();
      if (newStatus === "COMPLETED") {
        setJobs((prev) => prev.filter((j) => j.id !== requestId));
        if (resData.stripeCheckoutUrl) {
          setPaymentLink(resData.stripeCheckoutUrl);
        }
      } else {
        setJobs((prev) => prev.map((j) =>
          j.id === requestId ? { ...j, status: newStatus } : j
        ));
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

    if (next === "EN_ROUTE") {
      const distKm = myLoc ? haversineKm(myLoc.lat, myLoc.lng, job.latitude, job.longitude) : null;
      const suggested = distKm != null ? Math.max(5, Math.round(distKm * 3 / 5) * 5) : (job.estimatedMinutes ?? 30);
      setEtaConfirm({ job, eta: suggested });
      return;
    }

    if (next === "COMPLETED") {
      setCompleteConfirm({
        job,
        batteryAh:     job.serviceType === "BATTERY_REPLACEMENT" ? 55 : null,
        batteryBrand:  "",
        paymentMethod: "CASH",
        finalPrice:    job.estimatedPrice ?? 0,
        notes:         "",
      });
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

        {/* Android: native install prompt */}
        {installPrompt && !isInstalled && (
          <div className="mb-4 bg-indigo-500/15 border border-indigo-500/40 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📲</span>
              <div>
                <div className="font-semibold text-indigo-300 text-sm">Εγκαταστήστε την εφαρμογή</div>
                <div className="text-xs text-slate-400">Άμεση πρόσβαση από την αρχική οθόνη</div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setInstallPrompt(null)} className="text-slate-500 text-xs px-2 py-1">Αργότερα</button>
              <button
                onClick={handleInstall}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition"
              >
                Εγκατάσταση
              </button>
            </div>
          </div>
        )}

        {/* iOS Safari: manual instructions */}
        {showIosHint && !isInstalled && (
          <div className="mb-4 bg-blue-500/15 border border-blue-500/40 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📲</span>
                <div>
                  <div className="font-semibold text-blue-300 text-sm">Εγκαταστήστε την εφαρμογή</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Πατήστε <span className="text-white font-medium">Κοινοποίηση ↑</span> και μετά{" "}
                    <span className="text-white font-medium">&ldquo;Προσθήκη στην Αρχική Οθόνη&rdquo;</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowIosHint(false)} className="text-slate-500 text-lg leading-none">×</button>
            </div>
          </div>
        )}

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
            <div className="w-11 h-11 rounded-xl bg-amber-600 flex items-center justify-center text-lg font-bold shadow-lg shadow-amber-900/30">🔧</div>
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

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Ενεργά",   value: jobs.length,                            color: "text-amber-400" },
            { label: "Σύνολο",   value: completedTotal,                          color: "text-blue-400"  },
            { label: "Rating ⭐", value: techProfile?.rating.toFixed(1) ?? "—", color: "text-yellow-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 mb-4">{error}</div>
        )}

        <div className="mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
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
                const distKm = myLoc ? haversineKm(myLoc.lat, myLoc.lng, job.latitude, job.longitude) : null;
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
                          {job.estimatedMinutes != null && <span className="text-cyan-300">⏱ ETA admin: {job.estimatedMinutes} λεπτ.</span>}
                          {distKm != null && <span className="text-slate-400">📏 {distKm.toFixed(1)} km</span>}
                        </div>
                      )}
                      {job.estimatedPrice != null && <div className="text-purple-300 font-medium">💰 {job.estimatedPrice}€</div>}
                    </div>

                    <div className="flex gap-2">
                      <a href={`https://maps.google.com/?q=${job.latitude},${job.longitude}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 bg-blue-700/30 hover:bg-blue-700/50 text-blue-300 text-sm font-medium py-2.5 rounded-xl transition text-center">
                        🗺️ Maps
                      </a>
                      <a href={`https://waze.com/ul?ll=${job.latitude},${job.longitude}&navigate=yes`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 bg-cyan-700/30 hover:bg-cyan-700/50 text-cyan-300 text-sm font-medium py-2.5 rounded-xl transition text-center">
                        🚗 Waze
                      </a>
                      {NEXT_STATUS[job.status] && (
                        <button
                          onClick={() => handleAction(job)}
                          disabled={updatingId === job.id}
                          className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                        >
                          {updatingId === job.id ? "..." : job.status === "ACCEPTED" ? "🚗 Εκκινώ" : (NEXT_LABEL[job.status] ?? "Επόμενο")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {pendingJobs.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold mb-3 text-sm text-slate-400">Αναμονή Ανάθεσης ({pendingJobs.length})</h2>
            <div className="space-y-2">
              {pendingJobs.map((job) => (
                <div key={job.id} className="bg-white/3 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{SERVICE_LABELS[job.serviceType] ?? job.serviceType}</div>
                    <div className="text-xs text-slate-500">{job.address ?? `${job.latitude.toFixed(3)}, ${job.longitude.toFixed(3)}`}</div>
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
          <p className="text-slate-700 text-xs">Τελ. ανανέωση: {lastRefresh.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-slate-600 hover:text-slate-400 text-xs transition">
            Αποσύνδεση
          </button>
        </div>
      </div>

      {/* ETA confirm modal */}
      {etaConfirm && (() => {
        const { job, eta } = etaConfirm;
        const distKm = myLoc ? haversineKm(myLoc.lat, myLoc.lng, job.latitude, job.longitude) : null;
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold mb-1">Επιβεβαίωση Εκκίνησης</h3>
              <p className="text-slate-400 text-sm mb-5">{job.customer.name} · {job.address ?? `${job.latitude.toFixed(4)}, ${job.longitude.toFixed(4)}`}</p>
              {(distKm != null || job.estimatedMinutes != null) && (
                <div className="bg-slate-800 rounded-xl p-3 mb-5 flex gap-4 text-sm">
                  {distKm != null && <div className="text-center flex-1"><div className="text-lg font-bold text-blue-300">{distKm.toFixed(1)} km</div><div className="text-slate-500 text-xs">Απόσταση</div></div>}
                  {job.estimatedMinutes != null && <div className="text-center flex-1"><div className="text-lg font-bold text-slate-400">{job.estimatedMinutes} λεπτ.</div><div className="text-slate-500 text-xs">ETA admin</div></div>}
                </div>
              )}
              <div className="mb-6">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Εκτίμησέ σου (λεπτά)</div>
                <div className="flex items-center gap-3 justify-center">
                  <button onClick={() => setEtaConfirm((p) => p ? { ...p, eta: Math.max(5, p.eta - 5) } : p)}
                    className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-xl font-bold transition">−</button>
                  <div className="text-4xl font-bold text-purple-300 w-24 text-center">{eta}</div>
                  <button onClick={() => setEtaConfirm((p) => p ? { ...p, eta: Math.min(180, p.eta + 5) } : p)}
                    className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-xl font-bold transition">+</button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEtaConfirm(null)} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition text-sm">Ακύρωση</button>
                <button onClick={() => { updateStatus(job.id, "EN_ROUTE", { estimatedMinutes: eta }); setEtaConfirm(null); }}
                  disabled={updatingId === job.id}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold transition text-sm">
                  🚗 Εκκινώ →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Completion modal */}
      {completeConfirm && (() => {
        const c = completeConfirm;
        const isBattery = c.job.serviceType === "BATTERY_REPLACEMENT";
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm max-h-[92vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-1">Ολοκλήρωση Εργασίας</h3>
              <p className="text-slate-400 text-sm mb-5">
                {SERVICE_LABELS[c.job.serviceType]} · {c.job.customer.name} · <span className="font-mono">{c.job.vehicle.licensePlate}</span>
              </p>

              {/* Battery picker */}
              {isBattery && (
                <div className="mb-5">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Επιλογή Μπαταρίας</div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {BATTERY_TIERS.map((tier) => {
                      const price = (c.job.estimatedPrice ?? 49) + tier.surcharge;
                      return (
                        <button
                          key={tier.ah}
                          onClick={() => setCompleteConfirm((p) => p ? { ...p, batteryAh: tier.ah, finalPrice: price } : p)}
                          className={`p-3 rounded-xl border text-center transition ${
                            c.batteryAh === tier.ah
                              ? "bg-purple-600/30 border-purple-500/60 text-white"
                              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          <div className="font-bold text-sm">{tier.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{tier.sublabel}</div>
                          <div className="text-xs font-mono mt-1 text-purple-300">{price}€</div>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={c.batteryBrand}
                    onChange={(e) => setCompleteConfirm((p) => p ? { ...p, batteryBrand: e.target.value } : p)}
                    placeholder="Μάρκα/Μοντέλο (προαιρ.)  π.χ. Varta Blue Dynamic"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              )}

              {/* Payment method */}
              <div className="mb-5">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Τρόπος Πληρωμής</div>
                <div className="grid grid-cols-2 gap-3">
                  {(["CASH", "CARD"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setCompleteConfirm((p) => p ? { ...p, paymentMethod: m } : p)}
                      className={`p-4 rounded-xl border text-center transition ${
                        c.paymentMethod === m
                          ? "bg-green-600/20 border-green-500/50 text-green-300"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-2xl mb-1">{m === "CASH" ? "💵" : "💳"}</div>
                      <div className="text-sm font-medium">{m === "CASH" ? "Μετρητά" : "Κάρτα POS"}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Final price */}
              <div className="mb-5">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Τελική Τιμή</div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={c.finalPrice || ""}
                    onChange={(e) => setCompleteConfirm((p) => p ? { ...p, finalPrice: Number(e.target.value) } : p)}
                    className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-center text-2xl font-bold focus:outline-none focus:border-purple-500 transition"
                  />
                  <span className="text-2xl text-slate-400">€</span>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <textarea
                  value={c.notes}
                  onChange={(e) => setCompleteConfirm((p) => p ? { ...p, notes: e.target.value } : p)}
                  placeholder="Σημειώσεις τεχνικού (προαιρετικό)"
                  rows={2}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setCompleteConfirm(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition text-sm">
                  Ακύρωση
                </button>
                <button
                  disabled={!c.finalPrice || updatingId === c.job.id}
                  onClick={() => {
                    updateStatus(c.job.id, "COMPLETED", {
                      finalPrice:      c.finalPrice,
                      paymentMethod:   c.paymentMethod,
                      batteryAh:       c.batteryAh,
                      batteryBrand:    c.batteryBrand || null,
                      technicianNotes: c.notes || null,
                    });
                    setCompleteConfirm(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold transition text-sm"
                >
                  {updatingId === c.job.id ? "..." : "✅ Ολοκλήρωση"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment link modal — shown after CARD completion */}
      {paymentLink && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">💳</div>
              <h3 className="font-bold text-lg">Link Πληρωμής με Κάρτα</h3>
              <p className="text-slate-400 text-sm mt-1">Στείλτε αυτό το link στον πελάτη για να πληρώσει</p>
            </div>

            <div className="bg-slate-800 border border-white/10 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-400 break-all">{paymentLink}</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(paymentLink).catch(() => {});
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2500);
                }}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
              >
                {linkCopied ? "✓ Αντιγράφηκε!" : "📋 Αντιγραφή Link"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent("Πληρωμή υπηρεσίας: " + paymentLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-green-600/30 border border-green-500/40 hover:bg-green-600/40 text-green-300 font-semibold text-sm flex items-center justify-center gap-2 transition"
              >
                <span>📱</span> Αποστολή μέσω WhatsApp
              </a>
              <button
                onClick={() => setPaymentLink(null)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm transition"
              >
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
