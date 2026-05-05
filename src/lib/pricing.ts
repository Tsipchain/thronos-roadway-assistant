import { ServiceType } from '@prisma/client';
import { prisma } from './prisma';

export interface PricingBreakdown {
  basePrice: number;
  distanceSurcharge: number;
  nightSurcharge: number;
  weekendSurcharge: number;
  subtotal: number;
  platformFee: number;
  escrowFee: number;
  totalPrice: number;
  technicianEarnings: number;
  isNight: boolean;
  isWeekend: boolean;
}

const FALLBACK_BASE: Record<ServiceType, number> = {
  BATTERY_REPLACEMENT: 35,
  BATTERY_CHARGE: 25,
  TIRE_CHANGE: 40,
  TIRE_REPAIR: 20,
  DIAGNOSIS: 15,
};

const FALLBACK_PER_KM: Record<ServiceType, number> = {
  BATTERY_REPLACEMENT: 1.50,
  BATTERY_CHARGE: 1.00,
  TIRE_CHANGE: 1.20,
  TIRE_REPAIR: 0.80,
  DIAGNOSIS: 0.50,
};

const PLATFORM_FEE_PCT = 0.10;  // 10%
const ESCROW_FEE = 1.50;        // fixed €1.50 for blockchain
const NIGHT_SURCHARGE_PCT = 0.20;
const WEEKEND_SURCHARGE = 8.00;

function isNightTime(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export async function calculatePrice(input: {
  serviceType: ServiceType;
  distanceKm: number;
  tenantId?: string;
  now?: Date;
}): Promise<PricingBreakdown> {
  const now = input.now ?? new Date();

  // Fetch tenant-specific rule first, fallback to global rule
  const rule = await prisma.pricingRule.findFirst({
    where: {
      serviceType: input.serviceType,
      isActive: true,
      OR: [
        { tenantId: input.tenantId ?? null },
        { tenantId: null },
      ],
    },
    orderBy: { tenantId: 'asc' }, // prefer tenant-specific
  });

  const basePrice = rule?.basePrice ?? FALLBACK_BASE[input.serviceType];
  const perKm = rule?.perKmSurcharge ?? FALLBACK_PER_KM[input.serviceType];
  const night = isNightTime(now);
  const weekend = isWeekend(now);

  const distanceSurcharge = Math.round(input.distanceKm * perKm * 100) / 100;
  let subtotal = basePrice + distanceSurcharge;

  const nightSurcharge = night ? Math.round(subtotal * NIGHT_SURCHARGE_PCT * 100) / 100 : 0;
  const weekendSurcharge = weekend ? WEEKEND_SURCHARGE : 0;

  subtotal = subtotal + nightSurcharge + weekendSurcharge;

  const platformFee = Math.round(subtotal * PLATFORM_FEE_PCT * 100) / 100;
  const totalPrice = Math.round((subtotal + platformFee + ESCROW_FEE) * 100) / 100;
  const technicianEarnings = Math.round((subtotal - platformFee) * 100) / 100;

  return {
    basePrice,
    distanceSurcharge,
    nightSurcharge,
    weekendSurcharge,
    subtotal,
    platformFee,
    escrowFee: ESCROW_FEE,
    totalPrice,
    technicianEarnings,
    isNight: night,
    isWeekend: weekend,
  };
}

// Backward-compatible simple estimate
export async function estimateServicePrice(input: {
  serviceType: ServiceType;
  distanceKm: number;
  now?: Date;
}): Promise<number> {
  const breakdown = await calculatePrice(input);
  return breakdown.totalPrice;
}
