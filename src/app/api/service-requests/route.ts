import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { UserRole, ServiceType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      // Guest SOS flow
      phone,
      plate,
      tenantId,
      // Authenticated flow
      customerId: existingCustomerId,
      vehicleId: existingVehicleId,
      // Common
      serviceType,
      latitude,
      longitude,
      symptoms = [],
      description,
    } = body;

    if (!serviceType || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "serviceType, latitude, longitude required" },
        { status: 400 }
      );
    }

    let customerId = existingCustomerId as string | undefined;
    let vehicleId = existingVehicleId as string | undefined;

    if (!customerId && phone) {
      if (!plate) {
        return NextResponse.json(
          { error: "plate required for guest flow" },
          { status: 400 }
        );
      }

      let customer = await prisma.user.findUnique({ where: { phone } });
      if (!customer) {
        const randomPw = await hash(Math.random().toString(36).slice(2), 10);
        customer = await prisma.user.create({
          data: {
            phone,
            email: `guest_${phone.replace(/\D/g, "")}@roadway.thronos`,
            passwordHash: randomPw,
            name: `Πελάτης ${phone.slice(-4)}`,
            role: UserRole.CUSTOMER,
            tenantId: tenantId ?? null,
          },
        });
      }
      customerId = customer.id;

      const normalizedPlate = plate.toUpperCase().replace(/[^A-ZΑ-Ω0-9]/g, "");
      let vehicle = await prisma.vehicle.findFirst({
        where: { userId: customerId, licensePlate: normalizedPlate },
      });
      if (!vehicle) {
        vehicle = await prisma.vehicle.create({
          data: {
            userId: customerId,
            licensePlate: normalizedPlate,
            make: "Άγνωστο",
            model: "Άγνωστο",
            year: new Date().getFullYear(),
          },
        });
      }
      vehicleId = vehicle.id;
    }

    if (!customerId || !vehicleId) {
      return NextResponse.json(
        { error: "customerId and vehicleId required" },
        { status: 400 }
      );
    }

    const request = await prisma.serviceRequest.create({
      data: {
        customerId,
        vehicleId,
        tenantId: tenantId ?? null,
        serviceType: serviceType as ServiceType,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        symptoms: Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean),
        description: description ?? null,
        status: "PENDING",
      },
    });

    // Async dispatch — do not await
    import("@/lib/dispatch")
      .then(({ findNearbyTechnicians }) => findNearbyTechnicians(request))
      .catch(console.error);

    return NextResponse.json(request, { status: 201 });
  } catch (e: any) {
    console.error("service-request POST error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (tenantId) where.tenantId = tenantId;
  if (status) where.status = status;

  const requests = await prisma.serviceRequest.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true } },
      vehicle: true,
      technician: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(requests);
}
