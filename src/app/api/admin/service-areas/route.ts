export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getServiceAreas,
  createServiceArea,
  updateServiceArea,
  deleteServiceArea,
} from "@/lib/pricing-admin";

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

    const areas = await getServiceAreas(user.tenantId);

    return NextResponse.json({ ok: true, areas });
  } catch (error) {
    console.error("Get service areas error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, city, centerLatitude, centerLongitude, radiusKm, serviceTypes, slaMinutes } =
      await req.json();

    if (!name || !city || centerLatitude == null || centerLongitude == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const area = await createServiceArea(user.tenantId, {
      name,
      city,
      centerLatitude: parseFloat(centerLatitude),
      centerLongitude: parseFloat(centerLongitude),
      radiusKm: parseFloat(radiusKm) || 15,
      serviceTypes: serviceTypes || [],
      slaMinutes: parseInt(slaMinutes) || 30,
    });

    return NextResponse.json({ ok: true, area }, { status: 201 });
  } catch (error) {
    console.error("Create service area error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { areaId, ...updateData } = await req.json();

    if (!areaId) {
      return NextResponse.json({ error: "Missing areaId" }, { status: 400 });
    }

    // Verify area belongs to tenant
    const area = await prisma.serviceArea.findUnique({
      where: { id: areaId },
    });

    if (!area || area.companyId !== user.tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await updateServiceArea(areaId, updateData);

    return NextResponse.json({ ok: true, area: updated });
  } catch (error) {
    console.error("Update service area error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { areaId } = await req.json();

    if (!areaId) {
      return NextResponse.json({ error: "Missing areaId" }, { status: 400 });
    }

    // Verify area belongs to tenant
    const area = await prisma.serviceArea.findUnique({
      where: { id: areaId },
    });

    if (!area || area.companyId !== user.tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteServiceArea(areaId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete service area error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
