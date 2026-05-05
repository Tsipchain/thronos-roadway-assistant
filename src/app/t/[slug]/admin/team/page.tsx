import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import TeamManagement from "@/components/TeamManagement";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: { slug: string } }) {
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
      btcPledgeVerified: true,
      pledgeVerifiedAt: true,
      enterpriseEnabled: true,
      thrRewardPoolBalance: true,
      teamMembers: {
        where: { isActive: true },
        include: {
          rewardTxs: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { amount: true, reason: true, status: true, createdAt: true, txHash: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!tenant) notFound();

  const serializedTenant = {
    ...tenant,
    pledgeVerifiedAt: tenant.pledgeVerifiedAt?.toISOString() ?? null,
    teamMembers: tenant.teamMembers.map((m) => ({
      ...m,
      rewardTxs: m.rewardTxs.map((tx) => ({
        ...tx,
        createdAt: tx.createdAt.toISOString(),
      })),
    })),
  };

  return <TeamManagement tenant={serializedTenant} />;
}
