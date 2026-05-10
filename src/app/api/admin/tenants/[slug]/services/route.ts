import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiceType } from "@prisma/client";

const BASE_PRICES: Record<string, number> = {
  BATTERY_REPLACEMENT: 49,
  BATTERY_CHARGE:      19,
  TIRE_CHANGE:         35,
  TIRE_REPAIR:         25,
  DIAGNOSIS:           15,
};

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    include: { pricingRules: { where: { isActive: true } } },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(tenant.pricingRules);
}

export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const services: Array<{ type: string; price: number }> = body.services ?? [];

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pricingRule.deleteMany({ where: { tenantId: tenant.id } });

  if (services.length > 0) {
    await prisma.pricingRule.createMany({
      data: services.map(({ type, price }) => ({
        tenantId: tenant.id,
        serviceType: type as ServiceType,
        basePrice: price ?? BASE_PRICES[type] ?? 0,
        perKmSurcharge: 0.5,
        nightSurcharge: 10,
        weekendSurcharge: 5,
        isActive: true,
      })),
    });
  }

  const updated = await prisma.pricingRule.findMany({
    where: { tenantId: tenant.id, isActive: true },
  });
  return NextResponse.json({ ok: true, rules: updated });
}
