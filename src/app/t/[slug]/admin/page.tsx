import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-amber-500/20 text-amber-300",
  ACCEPTED:    "bg-blue-500/20 text-blue-300",
  EN_ROUTE:    "bg-cyan-500/20 text-cyan-300",
  IN_PROGRESS: "bg-purple-500/20 text-purple-300",
  COMPLETED:   "bg-green-500/20 text-green-300",
  CANCELLED:   "bg-red-500/20 text-red-300",
  ARRIVED:     "bg-indigo-500/20 text-indigo-300",
};

const SERVICE_LABELS: Record<string, string> = {
  BATTERY_REPLACEMENT: "Αντικ. Μπαταρίας",
  BATTERY_CHARGE:      "Φόρτιση Μπαταρίας",
  TIRE_CHANGE:         "Αλλαγή Λάστιχου",
  TIRE_REPAIR:         "Επισκευή Λάστιχου",
  DIAGNOSIS:           "Διάγνωση",
};

export default async function TenantAdminPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    redirect("/login");
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    include: {
      serviceAreas: { where: { isActive: true }, orderBy: { city: "asc" } },
      pricingRules: { where: { isActive: true } },
      technicians: {
        include: { user: { select: { name: true, email: true, phone: true } } },
        orderBy: { isOnline: "desc" },
      },
      _count: { select: { teamMembers: true } },
    },
  });
  if (!tenant) notFound();

  const [pendingJobs, completedJobs, recentJobs] = await Promise.all([
    prisma.serviceRequest.count({
      where: {
        tenantId: tenant.id,
        status: { in: ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "ARRIVED"] },
      },
    }),
    prisma.serviceRequest.count({ where: { tenantId: tenant.id, status: "COMPLETED" } }),
    prisma.serviceRequest.findMany({
      where: { tenantId: tenant.id },
      include: {
        customer:   { select: { name: true, phone: true } },
        vehicle:    { select: { licensePlate: true, make: true, model: true } },
        technician: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const onlineTechs = tenant.technicians.filter((t) => t.isOnline).length;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-amber-900/30">
              {tenant.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              <p className="text-slate-400 text-sm">
                Admin · {tenant.phone}
                {tenant.enterpriseEnabled && (
                  <span className="ml-2 text-purple-400 font-medium">⚡ Enterprise</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Link
              href={`/t/${params.slug}/admin/stats`}
              className="text-sm bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-xl hover:bg-blue-600/30 transition text-blue-300"
            >
              📊 Στατιστικά
            </Link>
            <Link
              href={`/t/${params.slug}/admin/team`}
              className="text-sm bg-purple-600/20 border border-purple-500/30 px-4 py-2 rounded-xl hover:bg-purple-600/30 transition text-purple-300"
            >
              👥 Ομάδα ({tenant.technicians.length})
            </Link>
            <Link
              href={`/t/${params.slug}/admin/qr`}
              className="text-sm bg-white/5 border border-white/10 px-4 py-2 rounded-xl hover:bg-white/10 transition"
            >
              📱 QR Code
            </Link>
            <Link href={`/t/${params.slug}`} target="_blank"
              className="text-sm bg-white/5 border border-white/10 px-4 py-2 rounded-xl hover:bg-white/10 transition">
              SOS ↗
            </Link>
            {session.user.role === "SUPER_ADMIN" && (
              <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition">← Root</Link>
            )}
            <LogoutButton />
          </div>
        </div>

        {/* Enterprise CTA */}
        {!tenant.enterpriseEnabled && (
          <Link href={`/t/${params.slug}/admin/team`}
            className="flex items-center gap-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 mb-6 hover:bg-purple-500/15 transition">
            <div className="text-3xl">🔒</div>
            <div>
              <div className="font-semibold text-purple-300">Ξεκλειδώστε Enterprise — THR Wallets &amp; Rewards για την ομάδα σας</div>
              <div className="text-sm text-slate-400 mt-0.5">Απαιτείται pledge ≥ 0.011 BTC στο Thronos Chain → Ρύθμιση →</div>
            </div>
          </Link>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Τεχνικοί Online", value: onlineTechs,                color: "text-green-400" },
            { label: "Ενεργά Jobs",     value: pendingJobs,                color: "text-amber-400" },
            { label: "Ολοκληρωμένα",   value: completedJobs,              color: "text-blue-400" },
            { label: "Περιοχές",       value: tenant.serviceAreas.length, color: "text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className={`text-4xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Technicians */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Τεχνικοί</h2>
              <Link
                href={`/t/${params.slug}/admin/team`}
                className="text-xs text-purple-400 hover:text-purple-300 transition"
              >
                διαχείριση →
              </Link>
            </div>
            <div className="space-y-3">
              {tenant.technicians.map((tech) => (
                <div key={tech.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{tech.user.name}</div>
                    <div className="text-xs text-slate-400 truncate">{tech.user.phone}</div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full ${
                    tech.isOnline ? "bg-green-500/20 text-green-300" : "bg-slate-500/20 text-slate-400"
                  }`}>
                    {tech.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Τιμοκατάλογος</h2>
            <div className="space-y-3">
              {tenant.pricingRules.map((p) => (
                <div key={p.id} className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">{SERVICE_LABELS[p.serviceType] ?? p.serviceType}</span>
                  <div className="text-right">
                    <span className="font-medium text-purple-300">{p.basePrice}€</span>
                    <span className="text-slate-500 text-xs block">+{p.nightSurcharge}€ νύχτα</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service Areas */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Περιοχές</h2>
              <span className="text-xs text-slate-500">{tenant.serviceAreas.length} zones</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {tenant.serviceAreas.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span className="text-slate-300 truncate">{a.name}</span>
                  <span className="text-slate-500 shrink-0 ml-2">{a.radiusKm}km</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold">Πρόσφατα Jobs</h2>
            <Link
              href={`/t/${params.slug}/admin/stats`}
              className="text-xs text-blue-400 hover:text-blue-300 transition"
            >
              στατιστικά →
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="text-4xl mb-3">📋</div>
              <p>Δεν υπάρχουν jobs ακόμα.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-white/10 text-left">
                    <th className="pb-3">Πελάτης</th>
                    <th className="pb-3">Πινακίδα</th>
                    <th className="pb-3">Υπηρεσία</th>
                    <th className="pb-3">Τεχνικός</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Ημ/νία</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((j) => (
                    <tr key={j.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3">
                        <div className="font-medium">{j.customer.name}</div>
                        <div className="text-slate-500 text-xs">{j.customer.phone}</div>
                      </td>
                      <td className="py-3 font-mono text-slate-300">{j.vehicle.licensePlate}</td>
                      <td className="py-3 text-slate-300">{SERVICE_LABELS[j.serviceType] ?? j.serviceType}</td>
                      <td className="py-3 text-slate-400">{j.technician?.name ?? <span className="text-slate-600">—</span>}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[j.status] ?? "bg-white/10"}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 text-xs">
                        {new Date(j.createdAt).toLocaleDateString("el-GR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
