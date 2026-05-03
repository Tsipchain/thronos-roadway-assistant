import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await prisma.partnerCompany.findMany({
    include: {
      _count: { select: { technicians: true, requests: true, users: true } },
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
  const { name, slug, email, phone, vatNumber, billingAddress, plan = "starter" } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 });
  }

  const existing = await prisma.partnerCompany.findFirst({
    where: { OR: [{ slug }, { name }] },
  });
  if (existing) {
    return NextResponse.json({ error: "slug or name already taken" }, { status: 409 });
  }

  const tenant = await prisma.partnerCompany.create({
    data: { name, slug, email, phone, vatNumber, billingAddress, plan, status: "ACTIVE" },
  });

  return NextResponse.json(tenant, { status: 201 });
}
