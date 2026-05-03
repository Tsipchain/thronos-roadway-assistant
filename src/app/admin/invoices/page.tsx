import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import InvoicesPanel from "@/components/admin/InvoicesPanel";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const [invoices, tenants] = await Promise.all([
    prisma.tenantInvoice.findMany({
      include: { tenant: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.partnerCompany.findMany({
      select: { id: true, name: true, slug: true },
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);

  const stats = {
    draft: invoices.filter((i) => i.status === "DRAFT").length,
    sent: invoices.filter((i) => i.status === "SENT").length,
    paid: invoices.filter((i) => i.status === "PAID").length,
    overdue: invoices.filter((i) => i.status === "OVERDUE").length,
    totalPending: invoices
      .filter((i) => ["SENT", "OVERDUE"].includes(i.status))
      .reduce((s, i) => s + i.totalEur, 0),
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-slate-200 text-sm">← Admin</Link>
          <div>
            <h1 className="text-2xl font-bold">Τιμολόγια Tenants</h1>
            <p className="text-slate-400 text-sm">Fiat χρεώσεις · ΦΠΑ 24% · EUR</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Πρόχειρα", value: stats.draft, color: "text-slate-400" },
            { label: "Απεσταλμένα", value: stats.sent, color: "text-blue-400" },
            { label: "Εκπρόθεσμα", value: stats.overdue, color: "text-red-400" },
            { label: "Πληρωμένα", value: stats.paid, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {stats.totalPending > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 mb-6 text-sm">
            <span className="text-amber-400 font-semibold">Εκκρεμείς πληρωμές: </span>
            <span className="text-white">{stats.totalPending.toFixed(2)} EUR</span>
          </div>
        )}

        <InvoicesPanel
          invoices={JSON.parse(JSON.stringify(invoices))}
          tenants={tenants}
        />
      </div>
    </main>
  );
}
