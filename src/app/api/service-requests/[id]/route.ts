import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const request = await prisma.serviceRequest.findUnique({
      where: { id: params.id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: true,
        technician: { select: { name: true, phone: true } },
        payment: true,
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check authorization
    if (
      session?.user?.id !== request.customerId &&
      session?.user?.id !== request.technicianId &&
      session?.user?.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ request });
  } catch (error) {
    console.error("Service request GET error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
