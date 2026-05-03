import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";

const VAT = 24;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("tenantSlug");

  if (session.user.role !== "SUPER_ADMIN" && !tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (tenantSlug) {
    const t = await prisma.partnerCompany.findUnique({ where: { slug: tenantSlug } });
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccessTenant(session.user.role, session.user.tenantSlug, tenantSlug)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    where.tenantId = t.id;
  }

  const invoices = await prisma.tenantInvoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tenantSlug, description, amountEur, dueDate, lineItems = [], notes } = await req.json();
  if (!tenantSlug || !description || !amountEur) {
    return NextResponse.json({ error: "tenantSlug, description, amountEur required" }, { status: 400 });
  }

  const tenant = await prisma.partnerCompany.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Auto-generate invoice number
  const count = await prisma.tenantInvoice.count({ where: { tenantId: tenant.id } });
  const year = new Date().getFullYear();
  const number = `INV-${year}-${tenant.slug.toUpperCase()}-${String(count + 1).padStart(3, "0")}`;

  const totalEur = parseFloat((amountEur * (1 + VAT / 100)).toFixed(2));

  const invoice = await prisma.tenantInvoice.create({
    data: {
      tenantId: tenant.id,
      number,
      description,
      amountEur: parseFloat(amountEur),
      vatPct: VAT,
      totalEur,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      lineItems: lineItems.length ? lineItems : [{ description, qty: 1, unitPrice: amountEur }],
      notes: notes ?? null,
      status: "SENT",
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
