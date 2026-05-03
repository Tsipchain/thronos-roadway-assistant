import { prisma } from "./prisma";

export async function getTenantBySlug(slug: string) {
  return prisma.partnerCompany.findUnique({
    where: { slug },
    include: {
      serviceAreas: { where: { isActive: true }, orderBy: { name: "asc" } },
      pricingRules: { where: { isActive: true } },
    },
  });
}

export function canAccessTenant(
  userRole: string,
  userTenantSlug: string | null,
  targetSlug: string
): boolean {
  if (userRole === "SUPER_ADMIN") return true;
  return userTenantSlug === targetSlug;
}
