import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:     ["ACCEPTED", "CANCELLED"],
  ACCEPTED:    ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE:    ["ARRIVED", "CANCELLED"],
  ARRIVED:     ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
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
  const { status } = body;

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

  const timestampData: Record<string, Date> = {};
  if (status === "ACCEPTED")    timestampData.acceptedAt   = new Date();
  if (status === "ARRIVED")     timestampData.arrivedAt    = new Date();
  if (status === "COMPLETED")   timestampData.completedAt  = new Date();
  if (status === "CANCELLED")   timestampData.cancelledAt  = new Date();

  const updated = await prisma.serviceRequest.update({
    where: { id: params.requestId },
    data: {
      status: status as any,
      technicianId: request.technicianId ?? session.user.id,
      ...timestampData,
    },
  });

  if (status === "COMPLETED") {
    await prisma.technicianProfile.updateMany({
      where: { userId: updated.technicianId ?? session.user.id },
      data: { totalJobs: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true, status: updated.status });
}
