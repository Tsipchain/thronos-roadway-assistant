"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  PENDING:     "Εκκρεμεί",
  ACCEPTED:    "Αποδεκτό",
  EN_ROUTE:    "Σε δρόμο",
  ARRIVED:     "Έφτασε",
  IN_PROGRESS: "Εκτελείται",
  COMPLETED:   "Ολοκληρώθηκε",
  CANCELLED:   "Ακυρώθηκε",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
  ACCEPTED:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  EN_ROUTE:    "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  ARRIVED:     "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  IN_PROGRESS: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  COMPLETED:   "bg-green-500/20 text-green-300 border-green-500/30",
  CANCELLED:   "bg-red-500/20 text-red-300 border-red-500/30",
};

const SERVICE_LABELS: Record<string, string> = {
  BATTERY_REPLACEMENT: "Αντικ. Μπαταρίας",
  BATTERY_CHARGE:      "Φόρτιση Μπαταρίας",
  TIRE_CHANGE:         "Αλλαγή Λάστιχου",
  TIRE_REPAIR:         "Επισκευή Λάστιχου",
  DIAGNOSIS:           "Διάγνωση",
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
  technician: { name: string; phone: string } | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
}

interface Tech {
  userId: string;
  name: string;
  phone: string;
  isOnline: boolean;
  totalJobs: number;
  rating: number;
}

interface Props {
  slug: string;
  jobs: Job[];
  techs: Tech[];
}

type Filter = "PENDING" | "ACTIVE" | "COMPLETED" | "ALL";

export default function JobsClient({ slug, jobs: initialJobs, techs }: Props) {
  const router = useRouter();
  const [jobs, setJobs]           = useState<Job[]>(initialJobs);
  const [filter, setFilter]       = useState<Filter>("PENDING");
  const [dispatchJob, setDispatch] = useState<Job | null>(null);
  const [selectedTech, setTech]   = useState("");
  const [eta, setEta]             = useState(30);
  const [dispatching, setWorking] = useState(false);
  const [dispatchErr, setErr]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const etaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 20_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => { setJobs(initialJobs); }, [initialJobs]);

  const counts = {
    PENDING:   jobs.filter((j) => j.status === "PENDING").length,
    ACTIVE:    jobs.filter((j) => ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(j.status)).length,
    COMPLETED: jobs.filter((j) => ["COMPLETED", "CANCELLED"].includes(j.status)).length,
  };

  const filtered = jobs.filter((j) => {
    if (filter === "PENDING")   return j.status === "PENDING";
    if (filter === "ACTIVE")    return ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(j.status);
    if (filter === "COMPLETED") return ["COMPLETED", "CANCELLED"].includes(j.status);
    return true;
  });

  const openDispatch = (job: Job) => {
    setDispatch(job);
    setTech(techs.find((t) => t.isOnline)?.userId ?? "");
    setEta(30);
    setErr(null);
  };

  const submitDispatch = async () => {
    if (!dispatchJob || !selectedTech) return;
    setWorking(true);
    setErr(null);
    try {
      const res = await fetch(`/api/t/${slug}/jobs/${dispatchJob.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technicianId: selectedTech, estimatedMinutes: eta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Σφάλμα ανάθεσης");
      setJobs((prev) => prev.map((j) => (j.id === data.id ? { ...j, ...data } : j)));
      setDispatch(null);
      setFilter("ACTIVE");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          ["PENDING",   `Εκκρεμή (${counts.PENDING})`],
          ["ACTIVE",    `Ενεργά (${counts.ACTIVE})`],
          ["COMPLETED", `Ολοκλ. (${counts.COMPLETED})`],
          ["ALL",       "Όλα"],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${
              filter === f
                ? "bg-purple-600/30 border-purple-500/40 text-purple-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => { router.refresh(); setLastRefresh(new Date()); }}
          className="ml-auto px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 transition"
          title="Ανανέωση"
        >
          ↻
        </button>
        <span className="self-center text-xs text-slate-600">
          {lastRefresh.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm">Δεν υπάρχουν jobs σε αυτή την κατηγορία</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <div
              key={job.id}
              className={`bg-white/5 border rounded-2xl p-5 ${
                job.status === "PENDING" ? "border-amber-500/20" : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold">{job.customer.name}</div>
                  <a href={`tel:${job.customer.phone}`} className="text-sm text-blue-400 hover:text-blue-300">
                    📞 {job.customer.phone}
                  </a>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${
                  STATUS_COLORS[job.status] ?? "bg-white/10 text-white border-white/10"
                }`}>
                  {STATUS_LABELS[job.status] ?? job.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300 mb-3">
                <span>🚗 {job.vehicle.make} {job.vehicle.model} · <span className="font-mono">{job.vehicle.licensePlate}</span></span>
                <span>🔧 {SERVICE_LABELS[job.serviceType] ?? job.serviceType}</span>
                {job.technician && <span className="text-purple-300">👤 {job.technician.name}</span>}
                {job.estimatedMinutes != null && <span className="text-cyan-300">⏱ {job.estimatedMinutes} λεπτ. ETA</span>}
                {job.estimatedPrice != null && <span className="text-green-300">💰 {job.estimatedPrice}€</span>}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={`https://maps.google.com/?q=${job.latitude},${job.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition"
                  >
                    Google Maps ↗
                  </a>
                  <a
                    href={`https://waze.com/ul?ll=${job.latitude},${job.longitude}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 transition"
                  >
                    Waze ↗
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600">
                    {new Date(job.createdAt).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {job.status === "PENDING" && (
                    <button
                      onClick={() => openDispatch(job)}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition"
                    >
                      Ανάθεση →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dispatch modal */}
      {dispatchJob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-1">Ανάθεση Job</h3>
            <p className="text-slate-400 text-sm mb-5">
              {SERVICE_LABELS[dispatchJob.serviceType]} · {dispatchJob.customer.name} · <span className="font-mono">{dispatchJob.vehicle.licensePlate}</span>
            </p>

            {/* Customer location */}
            <div className="bg-slate-800 border border-white/10 rounded-xl p-4 mb-5">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Τοποθεσία Πελάτη</div>
              <div className="text-sm text-slate-200 mb-1">
                {dispatchJob.address ?? `${dispatchJob.latitude.toFixed(5)}, ${dispatchJob.longitude.toFixed(5)}`}
              </div>
              <div className="flex gap-3 mt-2">
                <a
                  href={`https://maps.google.com/?q=${dispatchJob.latitude},${dispatchJob.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-sm py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition"
                >
                  🗺️ Google Maps
                </a>
                <a
                  href={`https://waze.com/ul?ll=${dispatchJob.latitude},${dispatchJob.longitude}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-sm py-2 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 transition"
                >
                  🚗 Waze
                </a>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-400">
                Πελάτης: <a href={`tel:${dispatchJob.customer.phone}`} className="text-blue-400 hover:text-blue-300">{dispatchJob.customer.phone}</a>
              </div>
            </div>

            {/* Tech picker */}
            <div className="mb-5">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Επιλογή Τεχνικού</div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {techs.map((t) => (
                  <label
                    key={t.userId}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      selectedTech === t.userId
                        ? "bg-purple-600/20 border-purple-500/40"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tech"
                      value={t.userId}
                      checked={selectedTech === t.userId}
                      onChange={() => setTech(t.userId)}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-slate-400">{t.phone}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">{t.totalJobs} jobs</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.isOnline ? "bg-green-500/20 text-green-300" : "bg-slate-700 text-slate-500"
                      }`}>
                        {t.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* ETA */}
            <div className="mb-6">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Εκτιμώμενη Άφιξη</div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={5} max={120} step={5}
                  value={eta}
                  onChange={(e) => setEta(Number(e.target.value))}
                  className="flex-1 accent-purple-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={etaInput}
                    type="number"
                    min={5} max={180}
                    value={eta}
                    onChange={(e) => setEta(Math.max(5, Math.min(180, Number(e.target.value) || 30)))}
                    className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-center text-sm font-mono"
                  />
                  <span className="text-sm text-slate-400 shrink-0">λεπτ.</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>5 λεπτά</span><span>2 ώρες</span>
              </div>
            </div>

            {dispatchErr && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 mb-4">
                {dispatchErr}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDispatch(null)}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition text-sm"
              >
                Ακύρωση
              </button>
              <button
                onClick={submitDispatch}
                disabled={!selectedTech || dispatching}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold transition text-sm"
              >
                {dispatching ? "..." : "✓ Ανάθεση"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
