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
      make: vehicleMake,
      model: vehicleModel,
      year: vehicleYear,
      address,
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
            make: vehicleMake ?? "Άγνωστο",
            model: vehicleModel ?? "Άγνωστο",
            year: vehicleYear ? parseInt(vehicleYear, 10) : new Date().getFullYear(),
          },
        });
      } else if (vehicleMake && vehicleModel) {
        if (vehicle.make === "Άγνωστο" || vehicle.model === "Άγνωστο") {
          vehicle = await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
              make: vehicleMake,
              model: vehicleModel,
              year: vehicleYear ? parseInt(vehicleYear, 10) : vehicle.year,
            },
          });
        }
      }
      vehicleId = vehicle.id;
    }

    if (!customerId || !vehicleId) {
      return NextResponse.json(
        { error: "customerId and vehicleId required" },
        { status: 400 }
      );
    }

    // Check subscription status if this is a tenant request
    if (tenantId) {
      const tenant = await prisma.partnerCompany.findUnique({
        where: { id: tenantId },
      });

      if (tenant) {
        const now = new Date();
        if (!tenant.planActiveUntil || tenant.planActiveUntil <= now) {
          const daysExpired = tenant.planActiveUntil
            ? Math.floor((now.getTime() - tenant.planActiveUntil.getTime()) / (1000 * 60 * 60 * 24))
            : 999;

          if (daysExpired > 2) {
            return NextResponse.json(
              {
                error: "Service blocked: subscription expired",
                message: `Subscription expired ${daysExpired} days ago. Please renew to continue.`,
              },
              { status: 403 }
            );
          } else if (daysExpired > 0) {
            // Warning: subscription expired but within 2-day grace period
            console.warn(`Subscription expiring for ${tenant.name}`);
          }
        }
      }
    }

    const request = await prisma.serviceRequest.create({
      data: {
        customerId,
        vehicleId,
        tenantId: tenantId ?? null,
        serviceType: serviceType as ServiceType,
        latitude:  parseFloat(latitude),
        longitude: parseFloat(longitude),
        address:   typeof address === "string" && address.trim() ? address.trim() : null,
        symptoms:  Array.isArray(symptoms) ? symptoms : [symptoms].filter(Boolean),
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
  const status   = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (tenantId) where.tenantId = tenantId;
  if (status)   where.status   = status;

  const requests = await prisma.serviceRequest.findMany({
    where,
    include: {
      customer:   { select: { name: true, phone: true } },
      vehicle:    true,
      technician: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(requests);
}
