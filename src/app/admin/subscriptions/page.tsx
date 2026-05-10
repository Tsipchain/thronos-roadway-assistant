import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import SubscriptionsTable from "./SubscriptionsTable";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const now = new Date();

  const subscriptions = await prisma.partnerCompany.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      planActiveUntil: true,
      status: true,
      stripeCustomerId: true,
      email: true,
      _count: {
        select: {
          technicians: true,
          requests: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s) => s.planActiveUntil && s.planActiveUntil > now).length,
    expired: subscriptions.filter((s) => !s.planActiveUntil || s.planActiveUntil <= now).length,
    expiringSoon: subscriptions.filter((s) => {
      if (!s.planActiveUntil) return false;
      const daysUntilExpiry = (s.planActiveUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
    }).length,
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Subscriptions Management</h1>
            <p className="text-slate-400 text-sm mt-1">Monitor tenant subscriptions, renewals, and billing</p>
          </div>
          <Link
            href="/admin"
            className="text-slate-400 hover:text-slate-200 text-sm"
          >
            ← Back to Admin
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-3xl font-bold text-blue-400">{stats.total}</div>
            <div className="text-slate-400 text-sm mt-1">Total Subscriptions</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-3xl font-bold text-green-400">{stats.active}</div>
            <div className="text-slate-400 text-sm mt-1">Active Plans</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-3xl font-bold text-amber-400">{stats.expiringSoon}</div>
            <div className="text-slate-400 text-sm mt-1">Expiring Soon (7 days)</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="text-3xl font-bold text-red-400">{stats.expired}</div>
            <div className="text-slate-400 text-sm mt-1">Expired/Inactive</div>
          </div>
        </div>

        {/* Subscriptions Table */}
        <SubscriptionsTable subscriptions={subscriptions} />

      </div>
    </main>
  );
}
