import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "NOTIFIED";

  const attempts = await prisma.dispatchAttempt.findMany({
    where: {
      technicianId: context.params.id,
      status,
      request: {
        status: status === "ACCEPTED" ? "ACCEPTED" : "PENDING",
      },
    },
    include: {
      request: {
        include: {
          vehicle: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: [{ estimatedMinutes: "asc" }, { notifiedAt: "desc" }],
    take: 50,
  });

  const jobs = attempts.map((attempt) => ({
    id: attempt.request.id,
    serviceType: attempt.request.serviceType,
    status: attempt.request.status,
    distanceKm: attempt.distanceKm,
    estimatedMinutes: attempt.estimatedMinutes,
    estimatedPrice: attempt.request.estimatedPrice,
    symptoms: attempt.request.symptoms,
    vehicle: {
      make: attempt.request.vehicle.make,
      model: attempt.request.vehicle.model,
      year: attempt.request.vehicle.year,
      engineType: attempt.request.vehicle.engineType,
      batteryType: attempt.request.vehicle.batteryType,
      batteryAh: attempt.request.vehicle.batteryAh,
      tireSize: attempt.request.vehicle.tireSize,
    },
    location: {
      latitude: attempt.request.latitude,
      longitude: attempt.request.longitude,
      address: attempt.request.address,
    },
    customer: attempt.request.status === "ACCEPTED" ? attempt.request.customer : { id: attempt.request.customer.id, name: attempt.request.customer.name },
    notifiedAt: attempt.notifiedAt,
  }));

  return NextResponse.json({ jobs });
}
