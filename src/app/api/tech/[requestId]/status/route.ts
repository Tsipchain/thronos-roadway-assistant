import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:     ["ACCEPTED", "CANCELLED"],
  ACCEPTED:    ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE:    ["ARRIVED",  "CANCELLED"],
  ARRIVED:     ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED",   "CANCELLED"],
};

export async function PATCH(
  req: Request,
  { params }: { params: { requestId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TECHNICIAN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    status,
    // EN_ROUTE: tech updates their own ETA estimate
    estimatedMinutes,
    // COMPLETED: completion details
    finalPrice,
    paymentMethod, // "CASH" | "CARD"
    batteryAh,     // 45 | 55 | 65 | null
    batteryBrand,  // free text, e.g. "Varta Blue Dynamic"
    technicianNotes,
  } = body;

  const request = await prisma.serviceRequest.findUnique({
    where: { id: params.requestId },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = VALID_TRANSITIONS[request.status] ?? [];
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Invalid transition: ${request.status} → ${status}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    status,
    technicianId: request.technicianId ?? session.user.id,
  };

  if (status === "ACCEPTED")  updateData.acceptedAt  = new Date();
  if (status === "ARRIVED")   updateData.arrivedAt   = new Date();
  if (status === "COMPLETED") updateData.completedAt = new Date();
  if (status === "CANCELLED") updateData.cancelledAt = new Date();

  // Tech provides their own ETA when departing
  if (status === "EN_ROUTE" && typeof estimatedMinutes === "number" && estimatedMinutes >= 1) {
    updateData.estimatedMinutes = Math.max(1, Math.min(180, estimatedMinutes));
    updateData.acceptedAt = new Date(); // reset countdown from departure
  }

  // Save final price if tech confirmed it at completion
  if (status === "COMPLETED" && typeof finalPrice === "number" && finalPrice > 0) {
    updateData.finalPrice = finalPrice;
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: params.requestId },
    data: updateData as any,
  });

  if (status === "COMPLETED") {
    const techUserId = updated.technicianId ?? session.user.id;

    // Build parts list
    const partsUsed: string[] = [];
    if (batteryAh) {
      const label = batteryBrand
        ? `${batteryBrand} ${batteryAh}Ah`
        : `Μπαταρία ${batteryAh}Ah`;
      partsUsed.push(label);
    }

    // Create service record (skip if already exists)
    const existing = await prisma.serviceRecord.findUnique({ where: { requestId: updated.id } });
    if (!existing) {
      await prisma.serviceRecord.create({
        data: {
          requestId:      updated.id,
          vehicleId:      updated.vehicleId,
          serviceType:    updated.serviceType,
          description:    technicianNotes || "Ολοκλήρωση εργασίας",
          partsUsed,
          technicianNotes: technicianNotes || null,
        },
      });
    }

    // Record payment
    if (paymentMethod && finalPrice && finalPrice > 0) {
      const method = paymentMethod === "CARD" ? "CARD" : "CASH";
      await prisma.payment.upsert({
        where:  { requestId: updated.id },
        create: {
          requestId: updated.id,
          method:    method as any,
          status:    "COMPLETED",
          amount:    finalPrice,
          currency:  "EUR",
        },
        update: {
          method: method as any,
          status: "COMPLETED",
          amount: finalPrice,
        },
      });
    }

    // Increment technician's total jobs
    await prisma.technicianProfile.updateMany({
      where: { userId: techUserId },
      data:  { totalJobs: { increment: 1 } },
    });
  }

  return NextResponse.json({
    ok: true,
    status: updated.status,
    finalPrice: updated.finalPrice,
    estimatedMinutes: updated.estimatedMinutes,
  });
}
