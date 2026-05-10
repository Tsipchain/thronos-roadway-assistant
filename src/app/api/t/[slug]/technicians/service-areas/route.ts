import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || !canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { assignments } = await req.json();

  if (!Array.isArray(assignments)) {
    return NextResponse.json({ message: "Invalid assignments format" }, { status: 400 });
  }

  try {
    const tenant = await prisma.partnerCompany.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ message: "Tenant not found" }, { status: 404 });
    }

    // Update each technician's service area
    const updates = await Promise.all(
      assignments.map(({ technicianId, serviceAreaId }: any) =>
        prisma.technicianProfile.update({
          where: { id: technicianId },
          data: {
            serviceAreaId: serviceAreaId || null,
          },
        })
      )
    );

    return NextResponse.json({
      message: `Updated ${updates.length} technician(s)`,
      updated: updates.length,
    });
  } catch (error) {
    console.error("Error updating service areas:", error);
    return NextResponse.json(
      { message: "Failed to update service areas" },
      { status: 500 }
    );
  }
}
