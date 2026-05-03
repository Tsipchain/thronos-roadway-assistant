import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const [tenants, totalJobs, activeJobs, pendingP2P, pendingInvoices] = await Promise.all([
    prisma.partnerCompany.findMany({
      include: {
        _count: { select: { technicians: true, requests: true, users: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceRequest.count(),
    prisma.serviceRequest.count({
      where: { status: { in: ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] } },
    }),
    prisma.p2POrder.count({ where: { status: "QUOTE" } }),
    prisma.tenantInvoice.count({ where: { status: { in: ["SENT", "OVERDUE"] } } }),
  ]);

  const systemStats = [
    { label: "Tenants", value: tenants.length, color: "text-purple-400" },
    { label: "Σύνολο Jobs", value: totalJobs, color: "text-blue-400" },
    { label: "Ενεργά Jobs", value: activeJobs, color: "text-amber-400" },
    { label: "Platform", value: "LIVE", color: "text-green-400" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-xl font-bold shadow-lg shadow-purple-900/40">
              ⚡
            </div>
            <div>
              <h1 className="text-2xl font-bold">Thronos Roadway</h1>
              <p className="text-slate-400 text-sm">Root Admin · {session.user.email}</p>
            </div>
          </div>
          <Link
            href="/admin/tenants/new"
            className="bg-purple-600 hover:bg-purple-500 text-sm font-medium px-5 py-2.5 rounded-xl transition shadow"
          >
            + Νέος Partner
          </Link>
        </div>

        {/* System Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {systemStats.map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className={`text-4xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Action Nav Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link
            href="/admin/p2p"
            className="bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/60 rounded-2xl p-5 transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-amber-400 font-semibold text-base mb-1">P2P BTC Orders</div>
                <div className="text-slate-400 text-sm">Διαχείριση αγορών BTC · Επιβεβαίωση πληρωμών</div>
              </div>
              <div className="flex items-center gap-2">
                {pendingP2P > 0 && (
                  <span className="bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">
                    {pendingP2P} εκκρεμή
                  </span>
                )}
                <span className="text-slate-500 group-hover:text-slate-300 transition text-xl">→</span>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/invoices"
            className="bg-blue-500/10 border border-blue-500/30 hover:border-blue-400/60 rounded-2xl p-5 transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-blue-400 font-semibold text-base mb-1">Τιμολόγια Tenants</div>
                <div className="text-slate-400 text-sm">Fiat χρεώσεις · ΦΠΑ 24% · Δημιουργία τιμολογίων</div>
              </div>
              <div className="flex items-center gap-2">
                {pendingInvoices > 0 && (
                  <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    {pendingInvoices} ανοιχτά
                  </span>
                )}
                <span className="text-slate-500 group-hover:text-slate-300 transition text-xl">→</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Tenants Table */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-5">Partners / Tenants</h2>
          {tenants.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">🏢</div>
              <p>Δεν υπάρχουν partners ακόμα.</p>
              <Link href="/admin/tenants/new" className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block">
                Προσθέστε τον πρώτο →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-white/10 text-left">
                    <th className="pb-3">Εταιρεία</th>
                    <th className="pb-3">URL</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3 text-center">Τεχνικοί</th>
                    <th className="pb-3 text-center">Jobs</th>
                    <th className="pb-3 text-center">Χρήστες</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 font-medium">{t.name}</td>
                      <td className="py-3 text-slate-400 font-mono text-xs">/t/{t.slug}</td>
                      <td className="py-3">
                        <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full">
                          {t.plan}
                        </span>
                      </td>
                      <td className="py-3 text-center text-slate-300">{t._count.technicians}</td>
                      <td className="py-3 text-center text-slate-300">{t._count.requests}</td>
                      <td className="py-3 text-center text-slate-300">{t._count.users}</td>
                      <td className="py-3 text-center">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            t.status === "ACTIVE"
                              ? "bg-green-500/20 text-green-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-3 justify-end">
                          <Link
                            href={`/t/${t.slug}`}
                            className="text-slate-400 hover:text-slate-200 text-xs"
                            target="_blank"
                          >
                            SOS ↗
                          </Link>
                          <Link
                            href={`/t/${t.slug}/admin`}
                            className="text-purple-400 hover:text-purple-300 text-xs font-medium"
                          >
                            Admin →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-slate-600 text-xs">
          Thronos Chain · Roadway Platform v1.0
        </div>
      </div>
    </main>
  );
}
