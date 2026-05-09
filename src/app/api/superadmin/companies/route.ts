import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companies = await prisma.partnerCompany.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          serviceRequests: true,
          teamMembers: true,
        },
      },
      serviceRequests: {
        select: { totalPrice: true, status: true },
      },
    },
  });

  const result = companies.map((c) => {
    const totalRevenue = c.serviceRequests
      .filter((r) => r.status === "COMPLETED")
      .reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      email: c.email,
      phone: c.phone,
      plan: c.plan,
      status: c.status,
      createdAt: c.createdAt,
      totalRequests: c._count.serviceRequests,
      teamSize: c._count.teamMembers,
      totalRevenue,
    };
  });

  return NextResponse.json({ companies: result });
}
