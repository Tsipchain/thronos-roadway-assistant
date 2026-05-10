import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; jobId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await prisma.partnerCompany.findUnique({ where: { slug: params.slug } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { technicianId, estimatedMinutes } = body;
  if (!technicianId) return NextResponse.json({ error: "technicianId required" }, { status: 400 });

  const job = await prisma.serviceRequest.findFirst({
    where: { id: params.jobId, tenantId: tenant.id, status: "PENDING" },
  });
  if (!job) return NextResponse.json({ error: "Job not found or already dispatched" }, { status: 404 });

  const tech = await prisma.technicianProfile.findFirst({
    where: { userId: technicianId, companyId: tenant.id },
  });
  if (!tech) return NextResponse.json({ error: "Technician not in this company" }, { status: 404 });

  const updated = await prisma.serviceRequest.update({
    where: { id: params.jobId },
    data: {
      technicianId,
      estimatedMinutes: Math.max(5, Math.min(Number(estimatedMinutes) || 30, 180)),
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
    include: {
      customer:   { select: { name: true, phone: true } },
      vehicle:    { select: { licensePlate: true, make: true, model: true } },
      technician: { select: { name: true, phone: true } },
    },
  });

  return NextResponse.json({
    ...updated,
    createdAt:   updated.createdAt.toISOString(),
    acceptedAt:  updated.acceptedAt?.toISOString() ?? null,
    completedAt: updated.completedAt?.toISOString() ?? null,
  });
}
