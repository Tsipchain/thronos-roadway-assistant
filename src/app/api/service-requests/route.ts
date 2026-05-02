import { NextRequest, NextResponse } from "next/server";
import { ServiceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findNearbyTechnicians } from "@/lib/dispatch";
import { estimateServicePrice } from "@/lib/pricing";

const createRequestSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1),
  serviceType: z.nativeEnum(ServiceType),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  address: z.string().optional(),
  description: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  maxRadiusKm: z.number().positive().max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = createRequestSchema.parse(await req.json());

    const candidates = await findNearbyTechnicians({
      latitude: body.latitude,
      longitude: body.longitude,
      serviceType: body.serviceType,
      maxRadiusKm: body.maxRadiusKm,
    });

    const nearest = candidates[0];
    const estimatedPrice = await estimateServicePrice({
      serviceType: body.serviceType,
      distanceKm: nearest?.distanceKm ?? 0,
    });

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        customerId: body.customerId,
        vehicleId: body.vehicleId,
        serviceType: body.serviceType,
        latitude: body.latitude,
        longitude: body.longitude,
        address: body.address,
        description: body.description,
        symptoms: body.symptoms,
        estimatedMinutes: nearest?.estimatedMinutes,
        estimatedPrice,
        dispatchAttempts: {
          create: candidates.map((candidate) => ({
            technicianId: candidate.technicianUserId,
            radiusKm: body.maxRadiusKm ?? 15,
            distanceKm: candidate.distanceKm,
            estimatedMinutes: candidate.estimatedMinutes,
            status: "NOTIFIED",
          })),
        },
      },
      include: { vehicle: true, customer: true, dispatchAttempts: true },
    });

    return NextResponse.json({
      request: serviceRequest,
      candidates,
      message: candidates.length
        ? "Βρέθηκαν διαθέσιμοι συνεργάτες στην περιοχή."
        : "Δεν βρέθηκε διαθέσιμος συνεργάτης στην ακτίνα. Το κέντρο πρέπει να ειδοποιηθεί χειροκίνητα.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
