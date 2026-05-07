import { prisma } from "./prisma";
import { ServiceType } from "@prisma/client";

export interface PricingRuleInput {
  serviceType: ServiceType;
  basePrice: number;
  perKmSurcharge: number;
  nightSurcharge: number;
  weekendSurcharge: number;
}

export interface ServiceAreaInput {
  name: string;
  city: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  serviceTypes: ServiceType[];
  slaMinutes: number;
}

export async function createPricingRule(
  tenantId: string,
  data: PricingRuleInput
) {
  const existing = await prisma.pricingRule.findUnique({
    where: {
      serviceType_tenantId: {
        serviceType: data.serviceType,
        tenantId: tenantId || undefined,
      },
    },
  });

  if (existing) {
    return prisma.pricingRule.update({
      where: { id: existing.id },
      data: {
        basePrice: data.basePrice,
        perKmSurcharge: data.perKmSurcharge,
        nightSurcharge: data.nightSurcharge,
        weekendSurcharge: data.weekendSurcharge,
      },
    });
  }

  return prisma.pricingRule.create({
    data: {
      tenantId: tenantId || null,
      serviceType: data.serviceType,
      basePrice: data.basePrice,
      perKmSurcharge: data.perKmSurcharge,
      nightSurcharge: data.nightSurcharge,
      weekendSurcharge: data.weekendSurcharge,
    },
  });
}

export async function getPricingRules(tenantId?: string) {
  return prisma.pricingRule.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { serviceType: "asc" },
  });
}

export async function deletePricingRule(ruleId: string) {
  return prisma.pricingRule.delete({
    where: { id: ruleId },
  });
}

export async function createServiceArea(tenantId: string, data: ServiceAreaInput) {
  return prisma.serviceArea.create({
    data: {
      companyId: tenantId,
      name: data.name,
      city: data.city,
      centerLatitude: data.centerLatitude,
      centerLongitude: data.centerLongitude,
      radiusKm: data.radiusKm,
      serviceTypes: data.serviceTypes,
      slaMinutes: data.slaMinutes,
      isActive: true,
    },
  });
}

export async function getServiceAreas(tenantId: string) {
  return prisma.serviceArea.findMany({
    where: { companyId: tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateServiceArea(areaId: string, data: Partial<ServiceAreaInput>) {
  return prisma.serviceArea.update({
    where: { id: areaId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.city && { city: data.city }),
      ...(data.centerLatitude && { centerLatitude: data.centerLatitude }),
      ...(data.centerLongitude && { centerLongitude: data.centerLongitude }),
      ...(data.radiusKm && { radiusKm: data.radiusKm }),
      ...(data.serviceTypes && { serviceTypes: data.serviceTypes }),
      ...(data.slaMinutes && { slaMinutes: data.slaMinutes }),
    },
  });
}

export async function deleteServiceArea(areaId: string) {
  return prisma.serviceArea.delete({
    where: { id: areaId },
  });
}

export async function distributeRewards(
  tenantId: string,
  memberId: string,
  amount: number,
  reason: string
) {
  const member = await prisma.tenantTeamMember.findUnique({
    where: { id: memberId },
  });

  if (!member || member.tenantId !== tenantId) {
    throw new Error("Member not found");
  }

  // Create reward transaction
  const tx = await prisma.tenantRewardTx.create({
    data: {
      tenantId,
      memberId,
      amount,
      reason,
      status: "PENDING",
    },
  });

  // Update member balance
  await prisma.tenantTeamMember.update({
    where: { id: memberId },
    data: {
      thrBalance: { increment: amount },
      totalEarned: { increment: amount },
    },
  });

  return tx;
}

export async function getRewardHistory(tenantId: string, limit: number = 100) {
  return prisma.tenantRewardTx.findMany({
    where: { tenantId },
    include: {
      member: { select: { name: true, email: true, thrAddress: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getRewardStats(tenantId: string) {
  const [totalPending, totalDistributed, memberCount] = await Promise.all([
    prisma.tenantRewardTx.aggregate({
      where: { tenantId, status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.tenantRewardTx.aggregate({
      where: { tenantId, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.tenantTeamMember.count({
      where: { tenantId, isActive: true },
    }),
  ]);

  return {
    totalPending: totalPending._sum?.amount || 0,
    totalDistributed: totalDistributed._sum?.amount || 0,
    activeMemberCount: memberCount,
  };
}
