import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ManageSubscriptionForm from "./ManageSubscriptionForm";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const company = await prisma.partnerCompany.findUnique({
    where: { id: params.id },
    include: {
      _count: {
        select: {
          technicians: true,
          requests: true,
          users: true,
        },
      },
    },
  });

  if (!company) {
    redirect("/admin/subscriptions");
  }

  const now = new Date();
  const isExpired = !company.planActiveUntil || company.planActiveUntil <= now;
  const daysUntilExpiry = company.planActiveUntil
    ? Math.ceil((company.planActiveUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const getDaysOverdue = () => {
    if (!company.planActiveUntil || company.planActiveUntil > now) return 0;
    return Math.floor((now.getTime() - company.planActiveUntil.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin/subscriptions" className="text-slate-400 hover:text-slate-200 text-sm mb-2">
              ← Back to Subscriptions
            </Link>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-slate-400 text-sm mt-1">Subscription & Billing Details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

          {/* Status Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Current Status</h2>
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${
                  isExpired
                    ? "bg-red-500/20 text-red-300"
                    : daysUntilExpiry !== null && daysUntilExpiry <= 7
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-green-500/20 text-green-300"
                }`}
              >
                {isExpired ? "EXPIRED" : daysUntilExpiry !== null && daysUntilExpiry <= 7 ? "EXPIRING SOON" : "ACTIVE"}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-slate-400 text-sm">Plan</div>
                <div className="text-lg font-semibold text-purple-300">{company.plan}</div>
              </div>

              <div>
                <div className="text-slate-400 text-sm">Status</div>
                <div className="text-lg font-semibold">{company.status}</div>
              </div>

              <div>
                <div className="text-slate-400 text-sm">Valid Until</div>
                <div className="text-lg font-semibold">
                  {company.planActiveUntil
                    ? company.planActiveUntil.toLocaleDateString("el-GR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not Set"}
                </div>
              </div>

              {isExpired && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-4">
                  <div className="text-sm text-red-300">
                    {getDaysOverdue() > 2
                      ? "⚠️ Service is BLOCKED (expired >2 days)"
                      : `⚠️ Subscription expired ${getDaysOverdue()} day(s) ago. Service will block in ${2 - getDaysOverdue()} day(s).`}
                  </div>
                </div>
              )}

              {daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 7 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4">
                  <div className="text-sm text-amber-300">
                    ⏰ Expires in {daysUntilExpiry} day(s). Auto-renewal should trigger soon.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stripe Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Stripe Configuration</h2>
              <span className="text-2xl">💳</span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-slate-400 text-sm">Customer ID</div>
                <div className="text-sm font-mono text-slate-300">
                  {company.stripeCustomerId || "Not configured"}
                </div>
              </div>

              <div>
                <div className="text-slate-400 text-sm">Email</div>
                <div className="text-sm text-slate-300">{company.email || "Not provided"}</div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-3 mt-4">
                <div className="text-xs text-slate-400 mb-2">Next Steps:</div>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Subscription auto-renewals via Stripe billing</li>
                  <li>• Payment methods: Card, Bank Transfer</li>
                  <li>• Webhooks monitor renewal status</li>
                </ul>
              </div>
            </div>
          </div>

        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-slate-400 text-xs">Technicians</div>
            <div className="text-2xl font-bold mt-1">{company._count.technicians}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-slate-400 text-xs">Service Requests</div>
            <div className="text-2xl font-bold mt-1">{company._count.requests}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-slate-400 text-xs">Users</div>
            <div className="text-2xl font-bold mt-1">{company._count.users}</div>
          </div>
        </div>

        {/* Management Form */}
        <ManageSubscriptionForm companyId={company.id} company={company} />

      </div>
    </main>
  );
}
