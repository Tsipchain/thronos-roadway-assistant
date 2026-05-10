import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import { hash } from "bcryptjs";

function genPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string; techId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccessTenant(session.user.role, session.user.tenantSlug, params.slug))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tech = await prisma.technicianProfile.findFirst({
    where: { id: params.techId, tenant: { slug: params.slug } },
    select: { userId: true },
  });
  if (!tech) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newPassword = genPassword();
  await prisma.user.update({
    where: { id: tech.userId },
    data: { passwordHash: await hash(newPassword, 10) },
  });

  return NextResponse.json({ ok: true, newPassword });
}
