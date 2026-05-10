import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "TECHNICIAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { latitude, longitude, isOnline, isAvailable } = body;

  const data: Record<string, unknown> = {};
  if (typeof latitude    === "number")  data.latitude    = latitude;
  if (typeof longitude   === "number")  data.longitude   = longitude;
  if (typeof isOnline    === "boolean") data.isOnline    = isOnline;
  if (typeof isAvailable === "boolean") data.isAvailable = isAvailable;
  if (typeof latitude    === "number" && typeof longitude === "number") {
    data.lastLocationAt = new Date();
  }

  await prisma.technicianProfile.updateMany({
    where: { userId: session.user.id },
    data,
  });

  return NextResponse.json({ ok: true });
}
