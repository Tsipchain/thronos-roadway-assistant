import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import BuyBtcDesk from "@/components/BuyBtcDesk";

export const dynamic = "force-dynamic";

export default async function BuyBtcPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    redirect("/login");
  }

  const [tenant, rawOrders] = await Promise.all([
    prisma.partnerCompany.findUnique({
      where: { slug: params.slug },
      select: {
        name: true, slug: true,
        btcPledgeVerified: true, enterpriseEnabled: true,
        thrWalletAddress: true,
      },
    }),
    prisma.p2POrder.findMany({
      where: {
        tenant: { slug: params.slug },
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  if (!tenant) notFound();

  const recentOrders = rawOrders.map((o) => ({
    id: o.id,
    status: o.status,
    btcAmount: o.btcAmount,
    eurAmount: o.eurAmount,
    rateEurPerBtc: o.rateEurPerBtc,
    paymentRef: o.paymentRef,
    destinationBtc: o.destinationBtc,
    btcTxHash: o.btcTxHash,
    createdAt: o.createdAt.toISOString(),
    quoteExpiresAt: o.quoteExpiresAt.toISOString(),
  }));

  return <BuyBtcDesk tenant={tenant} recentOrders={recentOrders} userId={session.user.id} />;
}
