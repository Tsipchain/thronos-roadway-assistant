import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import Link from "next/link";
import PledgeOnboarding from "@/components/PledgeOnboarding";
import { getPledgeVaultAddress } from "@/lib/thronos-api";

export const dynamic = "force-dynamic";

export default async function PledgePage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    redirect("/login");
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      thrWalletAddress: true,
      btcPledgeAddress: true,
      btcPledgeVerified: true,
      pledgeVerifiedAt: true,
      enterpriseEnabled: true,
      pledgeHash: true,
    },
  });
  if (!tenant) redirect("/login");

  const vaultAddress = getPledgeVaultAddress();

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/t/${params.slug}/admin`} className="text-slate-400 hover:text-slate-200 text-sm">
            ← Admin
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Enterprise Activation</h1>
            <p className="text-slate-400 text-sm">BTC Pledge · THR Wallet · Team Rewards</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8 text-xs">
          {[
            { n: 1, label: "BTC Address" },
            { n: 2, label: "BTC Στελνετε" },
            { n: 3, label: "Enterprise" },
          ].map((step, i) => {
            const done =
              (step.n === 1 && tenant.btcPledgeAddress) ||
              (step.n === 2 && tenant.btcPledgeVerified >= 0.011) ||
              (step.n === 3 && tenant.enterpriseEnabled);
            const active =
              (step.n === 1 && !tenant.btcPledgeAddress) ||
              (step.n === 2 && tenant.btcPledgeAddress && !tenant.btcPledgeVerified) ||
              (step.n === 3 && tenant.btcPledgeVerified >= 0.011 && !tenant.enterpriseEnabled);
            return (
              <div key={step.n} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-white/20" />}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    done
                      ? "border-green-500/40 bg-green-500/10 text-green-300"
                      : active
                      ? "border-purple-500/60 bg-purple-500/20 text-purple-200"
                      : "border-white/10 text-slate-500"
                  }`}
                >
                  <span>{done ? "✓" : step.n}</span>
                  <span>{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {tenant.enterpriseEnabled ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">💼</div>
            <h2 className="text-xl font-bold text-green-300 mb-2">Enterprise Ενεργό</h2>
            <p className="text-slate-300 text-sm mb-2">
              Το BTC pledge επαληθεύτηκε με επιτυχία.
            </p>
            <p className="font-mono text-xs text-green-400 mb-4">
              THR: {tenant.thrWalletAddress}
            </p>
            <Link
              href={`/t/${params.slug}/admin/team`}
              className="inline-block bg-green-600 hover:bg-green-500 px-6 py-2 rounded-xl text-sm font-semibold transition"
            >
              Τεαμ Διαχείριση →
            </Link>
          </div>
        ) : (
          <PledgeOnboarding
            tenant={JSON.parse(JSON.stringify(tenant))}
            vaultAddress={vaultAddress}
          />
        )}
      </div>
    </main>
  );
}
