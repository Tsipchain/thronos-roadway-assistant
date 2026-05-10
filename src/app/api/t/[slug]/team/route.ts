import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import { getPlan, isUnlimited } from "@/lib/plans";
import { hash } from "bcryptjs";
import { UserRole } from "@prisma/client";

async function resolveTenant(slug: string, session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!session || !canAccessTenant(session.user.role, session.user.tenantSlug, slug)) return null;
  return prisma.partnerCompany.findUnique({ where: { slug }, select: { id: true, plan: true } });
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const tenant = await resolveTenant(params.slug, session);
  if (!tenant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const technicians = await prisma.technicianProfile.findMany({
    where: { companyId: tenant.id },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { totalJobs: "desc" },
  });
  return NextResponse.json(technicians);
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const tenant = await resolveTenant(params.slug, session);
  if (!tenant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Plan limit check
  const plan = getPlan(tenant.plan);
  if (!isUnlimited(plan.maxTechnicians)) {
    const count = await prisma.technicianProfile.count({ where: { companyId: tenant.id } });
    if (count >= plan.maxTechnicians) {
      return NextResponse.json({
        error: `Όριο πλανού: το ${plan.label} επιτρέπει μέχρι ${plan.maxTechnicians} τεχνικούς.`,
        limitReached: true,
      }, { status: 403 });
    }
  }

  const { name, phone, email, password } = await req.json();
  if (!name || !phone || !password)
    return NextResponse.json({ error: "name, phone, password απαιτούνται" }, { status: 400 });

  const existing = await prisma.user.findFirst({ where: { phone } });
  if (existing) return NextResponse.json({ error: "Τηλέφωνο ήδη υπάρχει" }, { status: 409 });

  const emailToUse = email?.trim() || `tech_${phone.replace(/\D/g, "")}@roadway.thronos`;
  const passwordHash = await hash(password, 10);

  const profile = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, phone, email: emailToUse, passwordHash, role: UserRole.TECHNICIAN, tenantId: tenant.id },
    });
    return tx.technicianProfile.create({
      data: { userId: user.id, companyId: tenant.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });
  });

  return NextResponse.json({
    id: profile.id, userId: profile.userId,
    isOnline: profile.isOnline, isAvailable: profile.isAvailable,
    totalJobs: profile.totalJobs, user: profile.user,
  }, { status: 201 });
}
