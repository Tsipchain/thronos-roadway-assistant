import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import { getPlan } from "@/lib/plans";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) redirect("/login");

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: { id: true, slug: true, plan: true },
  });
  if (!tenant) redirect("/login");

  const [technicians, serviceAreas] = await Promise.all([
    prisma.technicianProfile.findMany({
      where: { companyId: tenant.id },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { totalJobs: "desc" },
    }),
    prisma.serviceArea.findMany({
      where: { companyId: tenant.id, isActive: true },
      orderBy: { city: "asc" },
      select: { id: true, name: true, city: true, radiusKm: true },
    }),
  ]);

  const plan = getPlan(tenant.plan);

  return (
    <TeamClient
      tenantId={tenant.id}
      tenantSlug={params.slug}
      technicians={technicians.map((t) => ({
        id: t.id, userId: t.userId, isOnline: t.isOnline,
        isAvailable: t.isAvailable, totalJobs: t.totalJobs,
        serviceAreaId: t.serviceAreaId ?? null,
        user: t.user,
      }))}
      serviceAreas={serviceAreas}
      planLabel={plan.label}
      maxTechnicians={plan.maxTechnicians}
    />
  );
}
