import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { UserRole, ServiceType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [userCount, tenantCount] = await Promise.all([
      prisma.user.count(),
      prisma.partnerCompany.count(),
    ]);
    const superAdmin = await prisma.user.findUnique({
      where: { email: "admin@thronoschain.com" },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({
      initialized: !!superAdmin,
      users: userCount,
      tenants: tenantCount,
      superAdminCreatedAt: superAdmin?.createdAt ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: "admin@thronoschain.com" },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, message: "Database already initialized. Super admin exists." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Thronos Root Super Admin
      const superPw = await hash("ThrAdmin2025!", 12);
      await tx.user.create({
        data: {
          email: "admin@thronoschain.com",
          phone: "+306900000001",
          passwordHash: superPw,
          name: "Thronos Root Admin",
          role: UserRole.SUPER_ADMIN,
        },
      });

      // 2. LK Shop Tenant — μπαταρίες μόνο
      const lkshop = await tx.partnerCompany.create({
        data: {
          name: "LK Shop",
          slug: "lkshop",
          phone: "+302310769090",
          email: "info@lkshop.gr",
          vatNumber: "GR000000000",
          billingAddress: "Νέα Μοναστηρίου 112, Θεσσαλονίκη 56334",
          plan: "starter",
          status: "ACTIVE",
        },
      });

      // 3. LK Shop Admin
      const lkAdminPw = await hash("LKAdmin2025!", 12);
      await tx.user.create({
        data: {
          email: "admin@lkshop.gr",
          phone: "+306949062851",
          passwordHash: lkAdminPw,
          name: "LK Shop Admin",
          role: UserRole.ADMIN,
          tenantId: lkshop.id,
        },
      });

      // 4. Technicians
      const techData = [
        { name: "Νίκος Παπαδόπουλος",  phone: "+306971100001", email: "tech1@lkshop.gr", lat: 40.6401, lng: 22.9444 },
        { name: "Γιώργης Αθανασίου",   phone: "+306971100002", email: "tech2@lkshop.gr", lat: 40.6200, lng: 22.9600 },
        { name: "Κώστας Δημητρίου",    phone: "+306971100003", email: "tech3@lkshop.gr", lat: 40.6500, lng: 22.9200 },
        { name: "Παναγιώτης Σταμάτης", phone: "+306971100004", email: "tech4@lkshop.gr", lat: 40.6700, lng: 23.0000 },
        { name: "Αλέξανδρος Νικολάου", phone: "+306971100005", email: "tech5@lkshop.gr", lat: 40.5900, lng: 22.9100 },
      ];
      const techPw = await hash("Tech2025!", 12);
      for (const t of techData) {
        const user = await tx.user.create({
          data: {
            email: t.email, phone: t.phone, passwordHash: techPw,
            name: t.name, role: UserRole.TECHNICIAN, tenantId: lkshop.id,
          },
        });
        await tx.technicianProfile.create({
          data: {
            userId: user.id, companyId: lkshop.id,
            isOnline: true, isAvailable: true,
            latitude: t.lat, longitude: t.lng,
            specialties: [ServiceType.BATTERY_REPLACEMENT, ServiceType.BATTERY_CHARGE, ServiceType.DIAGNOSIS],
            coverageRadiusKm: 15,
          },
        });
      }

      // 5. Service Areas (batteries + diagnosis)
      const areas = [
        { name: "Κέντρο Θεσσαλονίκης", city: "Thessaloniki", lat: 40.6401, lng: 22.9444, r: 5 },
        { name: "Καλαμαριά",           city: "Thessaloniki", lat: 40.5914, lng: 22.9629, r: 5 },
        { name: "Σταυρούπολη",         city: "Thessaloniki", lat: 40.6700, lng: 22.9200, r: 5 },
        { name: "Αμπελόκηποι",         city: "Thessaloniki", lat: 40.6403, lng: 22.9169, r: 5 },
        { name: "Πυλαία",              city: "Thessaloniki", lat: 40.5700, lng: 22.9800, r: 5 },
        { name: "Εύοσμος",             city: "Thessaloniki", lat: 40.6756, lng: 22.8981, r: 5 },
        { name: "Χαλκιδική - Βορράς",  city: "Chalkidiki",  lat: 40.4500, lng: 23.1500, r: 20 },
        { name: "Κασσάνδρα",           city: "Chalkidiki",  lat: 40.1000, lng: 23.4000, r: 20 },
      ];
      for (const a of areas) {
        await tx.serviceArea.create({
          data: {
            companyId: lkshop.id, name: a.name, city: a.city, country: "GR",
            centerLatitude: a.lat, centerLongitude: a.lng, radiusKm: a.r,
            serviceTypes: [ServiceType.BATTERY_REPLACEMENT, ServiceType.BATTERY_CHARGE, ServiceType.DIAGNOSIS],
            slaMinutes: 30, isActive: true,
          },
        });
      }

      // 6. Pricing — μπαταρίες + διάγνωση ΜΟΝΟ (χωρίς λάστιχα)
      const pricing = [
        { type: ServiceType.BATTERY_REPLACEMENT, base: 49 },
        { type: ServiceType.BATTERY_CHARGE,      base: 19 },
        { type: ServiceType.DIAGNOSIS,           base: 15 },
      ];
      for (const p of pricing) {
        await tx.pricingRule.create({
          data: {
            tenantId: lkshop.id, serviceType: p.type, basePrice: p.base,
            perKmSurcharge: 0.5, nightSurcharge: 10, weekendSurcharge: 5, isActive: true,
          },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Η βάση δεδομένων αρχικοποιήθηκε επιτυχώς!",
      credentials: {
        superAdmin:  { email: "admin@thronoschain.com", password: "ThrAdmin2025!", url: "/admin" },
        tenantAdmin: { email: "admin@lkshop.gr",        password: "LKAdmin2025!",  url: "/t/lkshop/admin" },
        technician:  { email: "tech1@lkshop.gr",        password: "Tech2025!",     url: "/t/lkshop/tech" },
        customerSOS: { url: "/t/lkshop" },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
