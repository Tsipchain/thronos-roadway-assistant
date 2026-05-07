import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId || !user.tenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get active requests (not completed or cancelled)
    const requests = await prisma.serviceRequest.findMany({
      where: {
        tenantId: user.tenantId,
        status: {
          in: ["PENDING", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"],
        },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        technician: { select: { name: true, phone: true } },
        dispatchAttempts: {
          orderBy: { notifiedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formattedRequests = requests.map((req) => ({
      id: req.id,
      status: req.status,
      serviceType: req.serviceType,
      latitude: req.latitude,
      longitude: req.longitude,
      customer: req.customer,
      technician: req.technician,
      createdAt: req.createdAt.toISOString(),
      estimatedMinutes: req.dispatchAttempts[0]?.estimatedMinutes,
    }));

    return NextResponse.json({ ok: true, requests: formattedRequests });
  } catch (error) {
    console.error("Get live requests error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
