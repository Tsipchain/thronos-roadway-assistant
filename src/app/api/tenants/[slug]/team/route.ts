import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import { TeamMemberRole } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.partnerCompany.findUnique({ where: { slug: params.slug } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await prisma.tenantTeamMember.findMany({
    where: { tenantId: tenant.id, isActive: true },
    include: {
      rewardTxs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { amount: true, reason: true, status: true, createdAt: true, txHash: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ members, enterpriseEnabled: tenant.enterpriseEnabled });
}

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
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!tenant.enterpriseEnabled) {
    return NextResponse.json(
      { error: "Enterprise tier απαιτεί pledge ≥ 0.011 BTC στο Thronos Chain." },
      { status: 403 }
    );
  }

  const { name, phone, email, role = "EMPLOYEE", thrAddress, notes } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const member = await prisma.tenantTeamMember.create({
    data: {
      tenantId: tenant.id,
      name,
      phone: phone ?? null,
      email: email ?? null,
      role: role as TeamMemberRole,
      thrAddress: thrAddress ?? null,
      walletCreatedAt: thrAddress ? new Date() : null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(member, { status: 201 });
}
