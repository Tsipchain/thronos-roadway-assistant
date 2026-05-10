import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country") || "GR";
  const city    = searchParams.get("city")?.trim() || "";
  const service = searchParams.get("service") || "";

  const serviceAreaFilter: Record<string, unknown> = {
    isActive: true,
    country,
  };
  if (city) {
    serviceAreaFilter.city = { contains: city, mode: "insensitive" };
  }
  if (service) {
    serviceAreaFilter.serviceTypes = { has: service };
  }

  const tenants = await prisma.partnerCompany.findMany({
    where: {
      status: "ACTIVE",
      serviceAreas: { some: serviceAreaFilter },
    },
    select: {
      id:        true,
      name:      true,
      slug:      true,
      logoUrl:   true,
      phone:     true,
      plan:      true,
      serviceAreas: {
        where: serviceAreaFilter as any,
        select: { city: true, country: true, radiusKm: true, serviceTypes: true, slaMinutes: true },
        orderBy: { city: "asc" },
      },
      technicians: {
        where:  { isOnline: true, isAvailable: true },
        select: { id: true },
      },
      pricingRules: {
        where:   { isActive: true },
        select:  { serviceType: true, basePrice: true },
        orderBy: { basePrice: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 30,
  });

  const results = tenants.map((t) => {
    const minPrice = t.pricingRules.length > 0
      ? Math.min(...t.pricingRules.map((r) => Number(r.basePrice)))
      : null;

    const serviceTypes = Array.from(
      new Set(t.serviceAreas.flatMap((a) => a.serviceTypes as string[]))
    );

    const cities = Array.from(new Set(t.serviceAreas.map((a) => a.city)));

    const avgSla = t.serviceAreas.length > 0
      ? Math.round(t.serviceAreas.reduce((s, a) => s + a.slaMinutes, 0) / t.serviceAreas.length)
      : 30;

    return {
      id:            t.id,
      name:          t.name,
      slug:          t.slug,
      logoUrl:       t.logoUrl,
      phone:         t.phone,
      onlineTechs:   t.technicians.length,
      minPrice,
      serviceTypes,
      cities,
      avgSla,
    };
  });

  // Sort: online techs first, then alphabetical
  results.sort((a, b) => b.onlineTechs - a.onlineTechs || a.name.localeCompare(b.name));

  return NextResponse.json({ results, country, city });
}
