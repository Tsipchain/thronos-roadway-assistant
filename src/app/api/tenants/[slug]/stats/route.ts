import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    include: { _count: { select: { technicians: true, requests: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [pending, completed, todayRevenue, onlineTechs] = await Promise.all([
    prisma.serviceRequest.count({
      where: {
        tenantId: tenant.id,
        status: { in: ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] },
      },
    }),
    prisma.serviceRequest.count({
      where: { tenantId: tenant.id, status: "COMPLETED" },
    }),
    prisma.payment.aggregate({
      where: {
        request: { tenantId: tenant.id },
        status: "COMPLETED",
        createdAt: { gte: todayStart },
      },
      _sum: { amount: true },
    }),
    prisma.technicianProfile.count({
      where: { companyId: tenant.id, isOnline: true },
    }),
  ]);

  return NextResponse.json({
    tenant,
    stats: {
      onlineTechs,
      pendingJobs: pending,
      completedJobs: completed,
      todayRevenue: todayRevenue._sum.amount ?? 0,
    },
  });
}
