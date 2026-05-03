import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import P2POrdersPanel from "@/components/admin/P2POrdersPanel";

export const dynamic = "force-dynamic";

export default async function AdminP2PPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const orders = await prisma.p2POrder.findMany({
    include: {
      tenant: { select: { name: true, slug: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const stats = {
    quote: orders.filter((o) => o.status === "QUOTE").length,
    paid: orders.filter((o) => o.status === "PAID").length,
    sent: orders.filter((o) => o.status === "SENT").length,
    completed: orders.filter((o) => o.status === "COMPLETED").length,
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-slate-200 text-sm">← Admin</Link>
          <div>
            <h1 className="text-2xl font-bold">P2P BTC Orders</h1>
            <p className="text-slate-400 text-sm">Επιβεβαίωση πληρωμών EUR → αποστολή BTC</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Εκκρεμή (Quote)", value: stats.quote, color: "text-amber-400" },
            { label: "Πληρωμένα", value: stats.paid, color: "text-blue-400" },
            { label: "BTC Στάλθηκε", value: stats.sent, color: "text-purple-400" },
            { label: "Ολοκληρωμένα", value: stats.completed, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <P2POrdersPanel orders={JSON.parse(JSON.stringify(orders))} />
      </div>
    </main>
  );
}
