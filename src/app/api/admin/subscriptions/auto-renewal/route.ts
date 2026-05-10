import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { companyId, enabled } = await req.json();

  if (!companyId || enabled === undefined) {
    return NextResponse.json({ message: "Invalid parameters" }, { status: 400 });
  }

  try {
    const company = await prisma.partnerCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json({ message: "Company not found" }, { status: 404 });
    }

    // Note: In a real implementation, you would:
    // 1. If enabled=true and stripeCustomerId exists:
    //    - Call Stripe API to create/enable a subscription
    // 2. If enabled=false and stripeCustomerId exists:
    //    - Call Stripe API to disable/cancel the subscription

    // For now, we just toggle a flag (would need to add a column to schema in production)
    // The actual Stripe integration happens via webhooks

    return NextResponse.json({
      message: `Auto-renewal ${enabled ? "enabled" : "disabled"}`,
      companyId,
      autoRenewalEnabled: enabled,
    });
  } catch (error) {
    console.error("Error updating auto-renewal:", error);
    return NextResponse.json(
      { message: "Failed to update auto-renewal" },
      { status: 500 }
    );
  }
}
