export const dynamic = 'force-dynamic';
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

    // Get technicians from the tenant company
    const technicians = await prisma.user.findMany({
      where: {
        technicianProfile: { companyId: user.tenantId },
      },
      include: {
        technicianProfile: true,
        receivedReviews: {
          take: 100,
        },
        assignedRequests: {
          where: { status: "COMPLETED" },
        },
      },
    });

    const formattedTechs = technicians
      .filter((tech) => tech.technicianProfile?.latitude && tech.technicianProfile?.longitude)
      .map((tech) => {
        const profile = tech.technicianProfile!;
        const avgRating =
          tech.receivedReviews.length > 0
            ? tech.receivedReviews.reduce((sum, r) => sum + r.rating, 0) / tech.receivedReviews.length
            : 5.0;

        return {
          id: tech.id,
          name: tech.name,
          latitude: profile.latitude!,
          longitude: profile.longitude!,
          isOnline: profile.isOnline,
          isAvailable: profile.isAvailable,
          rating: avgRating,
          totalJobs: tech.assignedRequests.length,
        };
      });

    return NextResponse.json({ ok: true, technicians: formattedTechs });
  } catch (error) {
    console.error("Get live technicians error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
