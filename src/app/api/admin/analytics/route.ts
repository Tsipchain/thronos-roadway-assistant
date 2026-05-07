export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantMetrics, getTenantAnalytics } from "@/lib/admin-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin of a tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId || !user.tenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get("metric") || "overview";
    const daysBack = parseInt(searchParams.get("daysBack") || "30", 10);

    let result;

    if (metric === "overview") {
      result = await getTenantMetrics(user.tenantId, daysBack);
    } else if (metric === "detailed") {
      result = await getTenantAnalytics(user.tenantId);
    } else {
      return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
