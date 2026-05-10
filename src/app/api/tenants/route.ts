import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiceType } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await prisma.partnerCompany.findMany({
    include: {
      _count:       { select: { technicians: true, requests: true, users: true } },
      pricingRules: { where: { isActive: true }, select: { serviceType: true, basePrice: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name, slug, email, phone, vatNumber, billingAddress,
    plan = "starter",
    services = [] as Array<{ type: string; price: number }>,
  } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }

  const existing = await prisma.partnerCompany.findFirst({
    where: { OR: [{ slug }, { name }] },
  });
  if (existing) {
    return NextResponse.json({ error: "slug ή name υπάρχει ήδη" }, { status: 409 });
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.partnerCompany.create({
      data: { name, slug, email, phone, vatNumber, billingAddress, plan, status: "ACTIVE" },
    });

    if (services.length > 0) {
      await tx.pricingRule.createMany({
        data: services.map(({ type, price }: { type: string; price: number }) => ({
          tenantId:        t.id,
          serviceType:     type as ServiceType,
          basePrice:       price,
          perKmSurcharge:  0.5,
          nightSurcharge:  10,
          weekendSurcharge: 5,
          isActive:        true,
        })),
      });
    }

    return t;
  });

  return NextResponse.json(tenant, { status: 201 });
}
