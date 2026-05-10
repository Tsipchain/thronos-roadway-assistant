import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { companyId, daysToAdd } = await req.json();

  if (!companyId || !daysToAdd || daysToAdd <= 0) {
    return NextResponse.json({ message: "Invalid parameters" }, { status: 400 });
  }

  try {
    const company = await prisma.partnerCompany.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json({ message: "Company not found" }, { status: 404 });
    }

    // Calculate new expiry date
    const now = new Date();
    const baseDate = company.planActiveUntil && company.planActiveUntil > now
      ? company.planActiveUntil
      : now;

    const newExpiryDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    // Update subscription
    await prisma.partnerCompany.update({
      where: { id: companyId },
      data: {
        planActiveUntil: newExpiryDate,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      message: "Subscription extended successfully",
      newExpiryDate,
    });
  } catch (error) {
    console.error("Error extending subscription:", error);
    return NextResponse.json(
      { message: "Failed to extend subscription" },
      { status: 500 }
    );
  }
}
