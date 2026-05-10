import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Αναμονή",
  ACCEPTED: "Ανάθεση",
  EN_ROUTE: "Δρόμο",
  ARRIVED: "Άφιξη",
  IN_PROGRESS: "Εκτέλεση",
  COMPLETED: "Ολοκλήρωση",
  CANCELLED: "Ακύρωση",
};

const STATUS_BAR_COLOR: Record<string, string> = {
  PENDING: "bg-amber-500",
  ACCEPTED: "bg-blue-500",
  EN_ROUTE: "bg-cyan-500",
  ARRIVED: "bg-indigo-500",
  IN_PROGRESS: "bg-purple-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default async function StatsPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) redirect("/login");

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: { id: true, slug: true },
  });
  if (!tenant) redirect("/login");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [statusGroups, recentJobs, techStats, revenueAgg] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ["status"],
      where: { tenantId: tenant.id },
      _count: { status: true },
    }),
    prisma.serviceRequest.findMany({
      where: { tenantId: tenant.id, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.technicianProfile.findMany({
      where: { tenantId: tenant.id },
      include: { user: { select: { name: true } } },
      orderBy: { totalJobs: "desc" },
    }),
    prisma.serviceRequest.aggregate({
      where: { tenantId: tenant.id, status: "COMPLETED", finalPrice: { not: null } },
      _sum: { finalPrice: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  let totalJobs = 0;
  statusGroups.forEach((g) => {
    statusCounts[g.status] = g._count.status;
    totalJobs += g._count.status;
  });

  const completedCount = statusCounts["COMPLETED"] ?? 0;
  const activeCount =
    (statusCounts["PENDING"] ?? 0) +
    (statusCounts["ACCEPTED"] ?? 0) +
    (statusCounts["EN_ROUTE"] ?? 0) +
    (statusCounts["ARRIVED"] ?? 0) +
    (statusCounts["IN_PROGRESS"] ?? 0);
  const totalRevenue = Number(revenueAgg._sum.finalPrice ?? 0);

  // Jobs per day for last 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    return {
      label: d.toLocaleDateString("el-GR", { weekday: "short", day: "numeric" }),
      count: recentJobs.filter((j) => {
        const jd = new Date(j.createdAt);
        return jd.getDate() === d.getDate() && jd.getMonth() === d.getMonth();
      }).length,
    };
  });
  const maxDay = Math.max(...days.map((d) => d.count), 1);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center gap-3 mb-8 text-sm">
          <Link href={`/t/${params.slug}/admin`} className="text-slate-400 hover:text-white transition">← Admin</Link>
          <span className="text-slate-600">/</span>
          <h1 className="text-xl font-bold">📊 Στατιστικά</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Σύνολο Jobs",      value: totalJobs,                    color: "text-white" },
            { label: "Ολοκληρωμένα",    value: completedCount,              color: "text-green-400" },
            { label: "Ενεργά",         value: activeCount,                  color: "text-amber-400" },
            { label: "Έσοδα",          value: `${totalRevenue.toFixed(0)}€`, color: "text-purple-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Status breakdown */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Κατανομή Jobs ανά Κατάσταση</h2>
            {totalJobs === 0 ? (
              <p className="text-slate-500 text-sm">Δεν υπάρχουν jobs ακόμα.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{STATUS_LABELS[status] ?? status}</span>
                      <span className="text-slate-400">{count} ({Math.round((count / totalJobs) * 100)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_BAR_COLOR[status] ?? "bg-slate-500"}`}
                        style={{ width: `${Math.round((count / totalJobs) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last 7 days chart */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Jobs τελευταίες 7 μέρες</h2>
            <div className="flex items-end gap-2 h-28">
              {days.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  {d.count > 0 && (
                    <span className="text-xs text-slate-400">{d.count}</span>
                  )}
                  <div
                    className="w-full rounded-t-md bg-purple-600/70"
                    style={{
                      height: d.count > 0 ? `${Math.round((d.count / maxDay) * 96)}px` : "2px",
                      opacity: d.count > 0 ? 1 : 0.2,
                    }}
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Technician leaderboard */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h2 className="font-semibold mb-5">🏆 Τεχνικοί — Leaderboard</h2>
          {techStats.length === 0 ? (
            <p className="text-slate-500 text-sm">Δεν υπάρχουν τεχνικοί.</p>
          ) : (
            <div className="space-y-4">
              {techStats.map((tech, i) => (
                <div key={tech.id} className="flex items-center gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      i === 0
                        ? "bg-amber-500/30 text-amber-300"
                        : i === 1
                        ? "bg-slate-400/20 text-slate-300"
                        : i === 2
                        ? "bg-orange-700/30 text-orange-400"
                        : "bg-white/5 text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{tech.user.name}</span>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${tech.isOnline ? "bg-green-400" : "bg-slate-600"}`} />
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width:
                            techStats[0].totalJobs > 0
                              ? `${Math.round((tech.totalJobs / techStats[0].totalJobs) * 100)}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-purple-300 font-bold text-sm shrink-0">{tech.totalJobs} jobs</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
