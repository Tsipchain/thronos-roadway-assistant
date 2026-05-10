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
  const { status, estimatedMinutes } = body;

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

  if (status === "ACCEPTED")    updateData.acceptedAt   = new Date();
  if (status === "ARRIVED")     updateData.arrivedAt    = new Date();
  if (status === "COMPLETED")   updateData.completedAt  = new Date();
  if (status === "CANCELLED")   updateData.cancelledAt  = new Date();

  // When tech goes EN_ROUTE they can update ETA — reset acceptedAt so customer
  // countdown becomes accurate from the moment the tech actually departed
  if (status === "EN_ROUTE" && typeof estimatedMinutes === "number" && estimatedMinutes >= 1) {
    updateData.estimatedMinutes = Math.max(1, Math.min(180, estimatedMinutes));
    updateData.acceptedAt = new Date();
  }

  const updated = await prisma.serviceRequest.update({
    where: { id: params.requestId },
    data: updateData as any,
  });

  if (status === "COMPLETED") {
    await prisma.technicianProfile.updateMany({
      where: { userId: updated.technicianId ?? session.user.id },
      data: { totalJobs: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true, status: updated.status, estimatedMinutes: updated.estimatedMinutes });
}
