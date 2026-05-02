import { ServiceType } from "@prisma/client";
import { prisma } from "./prisma";

export async function estimateServicePrice(input: {
  serviceType: ServiceType;
  distanceKm: number;
  now?: Date;
}): Promise<number> {
  const now = input.now ?? new Date();
  const rule = await prisma.pricingRule.findUnique({ where: { serviceType: input.serviceType } });

  const fallbackBase: Record<ServiceType, number> = {
    BATTERY_REPLACEMENT: 40,
    BATTERY_CHARGE: 30,
    TIRE_CHANGE: 35,
    TIRE_REPAIR: 30,
    DIAGNOSIS: 25,
  };

  const basePrice = rule?.basePrice ?? fallbackBase[input.serviceType];
  const perKm = rule?.perKmSurcharge ?? 0.5;
  const night = rule?.nightSurcharge ?? 10;
  const weekend = rule?.weekendSurcharge ?? 5;

  const hour = now.getHours();
  const day = now.getDay();
  const isNight = hour >= 22 || hour < 7;
  const isWeekend = day === 0 || day === 6;

  const total = basePrice + input.distanceKm * perKm + (isNight ? night : 0) + (isWeekend ? weekend : 0);
  return Math.round(total * 100) / 100;
}
