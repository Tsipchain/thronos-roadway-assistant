import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const acceptSchema = z.object({
  technicianId: z.string().min(1),
  estimatedMinutes: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const body = acceptSchema.parse(await req.json());

    const existing = await prisma.serviceRequest.findUnique({ where: { id: context.params.id } });
    if (!existing) return NextResponse.json({ error: "Service request not found" }, { status: 404 });
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Request already assigned or closed" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const serviceRequest = await tx.serviceRequest.update({
        where: { id: context.params.id },
        data: {
          technicianId: body.technicianId,
          status: "ACCEPTED",
          acceptedAt: new Date(),
          estimatedMinutes: body.estimatedMinutes ?? existing.estimatedMinutes,
        },
        include: { vehicle: true, customer: true, technician: true },
      });

      await tx.technicianProfile.update({
        where: { userId: body.technicianId },
        data: { isAvailable: false },
      });

      await tx.dispatchAttempt.updateMany({
        where: { requestId: context.params.id, technicianId: body.technicianId },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });

      await tx.dispatchAttempt.updateMany({
        where: { requestId: context.params.id, technicianId: { not: body.technicianId }, status: "NOTIFIED" },
        data: { status: "EXPIRED" },
      });

      return serviceRequest;
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
