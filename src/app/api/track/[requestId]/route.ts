import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: params.requestId },
    include: {
      technician: { select: { name: true, phone: true } },
      vehicle:    { select: { licensePlate: true, make: true, model: true } },
      tenant:     { select: { name: true, phone: true, slug: true } },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: request.id,
    status: request.status,
    serviceType: request.serviceType,
    estimatedMinutes: request.estimatedMinutes ?? null,
    estimatedPrice: request.estimatedPrice ? Number(request.estimatedPrice) : null,
    finalPrice: request.finalPrice ? Number(request.finalPrice) : null,
    acceptedAt: request.acceptedAt?.toISOString() ?? null,
    technician: request.technician ?? null,
    vehicle: request.vehicle,
    tenant: request.tenant,
  });
}
