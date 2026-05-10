import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getTenant(slug: string) {
  return prisma.partnerCompany.findUnique({ where: { slug } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(params.slug);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Recent payouts for this tenant
  const payouts = await prisma.tenantPayout.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totals = await prisma.tenantPayout.aggregate({
    where: { tenantId: tenant.id, status: "PENDING" },
    _sum: { netAmountEur: true },
    _count: true,
  });

  return NextResponse.json({
    settings: {
      payoutMethod: tenant.payoutMethod,
      payoutIban: tenant.payoutIban,
      payoutBic: tenant.payoutBic,
      payoutWalletAddress: tenant.payoutWalletAddress,
      platformFeePercent: tenant.platformFeePercent,
    },
    payouts,
    pendingTotal: totals._sum.netAmountEur ?? 0,
    pendingCount: totals._count,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(params.slug);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { payoutMethod, payoutIban, payoutBic, payoutWalletAddress } = await req.json();

  const updated = await prisma.partnerCompany.update({
    where: { id: tenant.id },
    data: {
      ...(payoutMethod ? { payoutMethod } : {}),
      ...(payoutIban !== undefined ? { payoutIban } : {}),
      ...(payoutBic !== undefined ? { payoutBic } : {}),
      ...(payoutWalletAddress !== undefined ? { payoutWalletAddress } : {}),
    },
    select: { payoutMethod: true, payoutIban: true, payoutBic: true, payoutWalletAddress: true },
  });

  return NextResponse.json({ settings: updated });
}
