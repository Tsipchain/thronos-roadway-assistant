import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPricingRules, createPricingRule, deletePricingRule } from "@/lib/pricing-admin";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin of a tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId || !user.tenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rules = await getPricingRules(user.tenantId);

    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    console.error("Get pricing rules error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { serviceType, basePrice, perKmSurcharge, nightSurcharge, weekendSurcharge } =
      await req.json();

    if (!serviceType || basePrice == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const rule = await createPricingRule(user.tenantId, {
      serviceType,
      basePrice,
      perKmSurcharge: perKmSurcharge || 0.5,
      nightSurcharge: nightSurcharge || 10,
      weekendSurcharge: weekendSurcharge || 5,
    });

    return NextResponse.json({ ok: true, rule }, { status: 201 });
  } catch (error) {
    console.error("Create pricing rule error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { ruleId } = await req.json();

    if (!ruleId) {
      return NextResponse.json({ error: "Missing ruleId" }, { status: 400 });
    }

    // Verify rule belongs to tenant
    const rule = await prisma.pricingRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule || rule.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deletePricingRule(ruleId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete pricing rule error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
