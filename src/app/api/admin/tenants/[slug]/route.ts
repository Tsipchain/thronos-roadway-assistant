import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: {
      id: true, name: true, slug: true, phone: true,
      plan: true, status: true, logoUrl: true,
      pricingRules: { where: { isActive: true }, select: { serviceType: true, basePrice: true } },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(tenant);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, phone, plan, status, logoUrl } = body;

  const tenant = await prisma.partnerCompany.update({
    where: { slug: params.slug },
    data: {
      ...(name    !== undefined && { name }),
      ...(phone   !== undefined && { phone: phone || null }),
      // Normalize plan to uppercase to match PLAN_LIMITS keys
      ...(plan    !== undefined && { plan: plan.toUpperCase() }),
      ...(status  !== undefined && { status }),
      ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
    },
  });

  return NextResponse.json({ ok: true, tenant });
}
