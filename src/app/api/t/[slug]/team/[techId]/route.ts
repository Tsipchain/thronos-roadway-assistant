import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; techId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessTenant(session.user.role, session.user.tenantSlug, params.slug))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, phone, email, serviceAreaId } = body;

  const tech = await prisma.technicianProfile.findFirst({
    where: { id: params.techId, tenant: { slug: params.slug } },
    select: { userId: true },
  });
  if (!tech) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.all([
    prisma.user.update({
      where: { id: tech.userId },
      data: {
        ...(name  !== undefined && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email }),
      },
    }),
    serviceAreaId !== undefined
      ? prisma.technicianProfile.update({
          where: { id: params.techId },
          data: { serviceAreaId: serviceAreaId || null },
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
