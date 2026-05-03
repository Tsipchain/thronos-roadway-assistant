import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import { sendThrReward } from "@/lib/thronos-api";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.partnerCompany.findUnique({ where: { slug: params.slug } });
  if (!tenant?.enterpriseEnabled) {
    return NextResponse.json({ error: "Enterprise tier required" }, { status: 403 });
  }
  if (!tenant.thrWalletAddress) {
    return NextResponse.json({ error: "Tenant THR wallet not configured" }, { status: 400 });
  }

  const { memberId, amount, reason } = await req.json();
  if (!memberId || !amount || amount <= 0) {
    return NextResponse.json({ error: "memberId and amount required" }, { status: 400 });
  }

  const member = await prisma.tenantTeamMember.findFirst({
    where: { id: memberId, tenantId: tenant.id, isActive: true },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (!member.thrAddress) {
    return NextResponse.json(
      { error: "Member δεν έχει THR wallet. Προσθέστε THR address πρώτα." },
      { status: 400 }
    );
  }

  // Create pending tx record
  const tx = await prisma.tenantRewardTx.create({
    data: {
      tenantId: tenant.id,
      memberId: member.id,
      amount,
      reason: reason ?? "Bonus",
      status: "PENDING",
    },
  });

  // Send on-chain (fire and update)
  const authSecret = process.env.THRONOS_PLATFORM_KEY ?? "";
  const result = await sendThrReward(
    tenant.thrWalletAddress,
    member.thrAddress,
    amount,
    authSecret,
    reason ?? "Roadway reward"
  );

  if (result.ok) {
    await prisma.$transaction([
      prisma.tenantRewardTx.update({
        where: { id: tx.id },
        data: { status: "CONFIRMED", txHash: result.txHash },
      }),
      prisma.tenantTeamMember.update({
        where: { id: member.id },
        data: {
          thrBalance: { increment: amount },
          totalEarned: { increment: amount },
        },
      }),
      prisma.partnerCompany.update({
        where: { id: tenant.id },
        data: { thrRewardPoolBalance: { decrement: amount } },
      }),
    ]);
    return NextResponse.json({ ok: true, txHash: result.txHash, amount });
  } else {
    await prisma.tenantRewardTx.update({
      where: { id: tx.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ error: result.error ?? "Chain error" }, { status: 502 });
  }
}
