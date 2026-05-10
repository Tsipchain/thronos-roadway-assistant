import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

export default async function TrackingPage({
  params,
}: {
  params: { slug: string; requestId: string };
}) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: params.requestId },
    include: {
      customer:   { select: { name: true, phone: true } },
      technician: { select: { name: true, phone: true } },
      vehicle:    { select: { licensePlate: true, make: true, model: true } },
      tenant:     { select: { name: true, phone: true, slug: true } },
    },
  });

  if (!request || request.tenant?.slug !== params.slug) notFound();

  const statusIndex = STATUS_ORDER.indexOf(request.status);
  const isCancelled = request.status === "CANCELLED";
  const isCompleted = request.status === "COMPLETED";

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-md mx-auto">

        {/* Status Hero */}
        <div className="text-center py-8 mb-6">
          <div className="text-6xl mb-3">{STATUS_ICONS[request.status] ?? "📋"}</div>
          <h1 className="text-2xl font-bold">{STATUS_LABELS[request.status] ?? request.status}</h1>
          <p className="text-slate-400 text-sm mt-1">{request.tenant?.name}</p>
          {request.estimatedMinutes && !isCompleted && !isCancelled && (
            <p className="text-amber-400 text-sm mt-2 font-medium">
              εκτ. άφιξη: ~{request.estimatedMinutes} λεπτά
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
              <span className="font-medium">{SERVICE_LABELS[request.serviceType] ?? request.serviceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Όχημα</span>
              <span>{request.vehicle.make} {request.vehicle.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Πινακίδα</span>
              <span className="font-mono">{request.vehicle.licensePlate}</span>
            </div>
            {request.estimatedPrice != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Εκτίμηση</span>
                <span className="text-purple-300 font-semibold">{request.estimatedPrice}€</span>
              </div>
            )}
            {request.finalPrice != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Τελικό Κόστος</span>
                <span className="text-green-300 font-semibold">{request.finalPrice}€</span>
              </div>
            )}
          </div>
        </div>

        {/* Technician */}
        {request.technician && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
            <h2 className="font-semibold mb-3 text-sm text-slate-300">Τεχνικός</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{request.technician.name}</div>
                <div className="text-sm text-slate-400">{request.technician.phone}</div>
              </div>
              <a
                href={`tel:${request.technician.phone}`}
                className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
              >
                📞 Κλήση
              </a>
            </div>
          </div>
        )}

        {/* Company contact */}
        {request.tenant?.phone && (
          <div className="text-center mb-4">
            <p className="text-slate-500 text-sm">Χρειάζεστε βοήθεια;</p>
            <a href={`tel:${request.tenant.phone}`} className="text-blue-400 hover:text-blue-300 text-sm">
              📞 {request.tenant.name}: {request.tenant.phone}
            </a>
          </div>
        )}

        {!isCompleted && !isCancelled && (
          <div className="text-center mb-4">
            <button
              onClick={() => window.location.reload()}
              className="text-slate-500 hover:text-slate-300 text-xs transition"
            >
              ↻ Ανανέωση κατάστασης
            </button>
          </div>
        )}

        <div className="text-center">
          <Link href={`/t/${params.slug}`} className="text-slate-600 hover:text-slate-400 text-sm transition">
            ← Νέο Αίτημα
          </Link>
        </div>

      </div>
    </main>
  );
}
