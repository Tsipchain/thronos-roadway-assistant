import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const payouts = await prisma.tenantPayout.findMany({
    where: status === "ALL" ? {} : { status: status as any },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, payoutMethod: true, payoutIban: true, payoutWalletAddress: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = await prisma.tenantPayout.aggregate({
    where: { status: "PENDING" },
    _sum: { netAmountEur: true, feeAmountEur: true, grossAmountEur: true },
    _count: true,
  });

  return NextResponse.json({ payouts, totals });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { payoutId, bankRef, cryptoTxHash, stripeTransferId, notes } = await req.json();
  if (!payoutId) return NextResponse.json({ error: "payoutId required" }, { status: 400 });

  const updated = await prisma.tenantPayout.update({
    where: { id: payoutId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(bankRef ? { bankRef } : {}),
      ...(cryptoTxHash ? { cryptoTxHash } : {}),
      ...(stripeTransferId ? { stripeTransferId } : {}),
      ...(notes ? { notes } : {}),
    },
  });

  return NextResponse.json({ payout: updated });
}
