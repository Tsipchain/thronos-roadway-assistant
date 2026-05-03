import { PrismaClient, UserRole, ServiceType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Thronos Roadway Platform...");

  // ── Thronos Root Super Admin ──────────────────────────────────────────
  const superPw = await hash("ThrAdmin2025!", 12);
  await prisma.user.upsert({
    where: { email: "admin@thronoschain.com" },
    update: {},
    create: {
      email: "admin@thronoschain.com",
      phone: "+306900000001",
      passwordHash: superPw,
      name: "Thronos Root Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });
  console.log("  ✓ Super admin: admin@thronoschain.com / ThrAdmin2025!");

  // ── LK Shop Tenant ────────────────────────────────────────────────────
  const lkshop = await prisma.partnerCompany.upsert({
    where: { slug: "lkshop" },
    update: {},
    create: {
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
  console.log(`  ✓ Tenant: LK Shop (id: ${lkshop.id})`)

  // ── LK Shop Admin ─────────────────────────────────────────────────────
  const lkAdminPw = await hash("LKAdmin2025!", 12);
  await prisma.user.upsert({
    where: { email: "admin@lkshop.gr" },
    update: {},
    create: {
      email: "admin@lkshop.gr",
      phone: "+306949062851",
      passwordHash: lkAdminPw,
      name: "LK Shop Admin",
      role: UserRole.ADMIN,
      tenantId: lkshop.id,
    },
  });
  console.log("  ✓ LK Shop admin: admin@lkshop.gr / LKAdmin2025!");

  // ── LK Shop Technicians ───────────────────────────────────────────────
  const techData = [
    { name: "Νίκος Παπαδόπουλος",    phone: "+306971100001", email: "tech1@lkshop.gr", lat: 40.6401, lng: 22.9444 },
    { name: "Γιώργης Αθανασίου",     phone: "+306971100002", email: "tech2@lkshop.gr", lat: 40.6200, lng: 22.9600 },
    { name: "Κώστας Δημητρίου",      phone: "+306971100003", email: "tech3@lkshop.gr", lat: 40.6500, lng: 22.9200 },
    { name: "Παναγιώτης Σταμάτης",   phone: "+306971100004", email: "tech4@lkshop.gr", lat: 40.6700, lng: 23.0000 },
    { name: "Αλέξανδρος Νικολάου",   phone: "+306971100005", email: "tech5@lkshop.gr", lat: 40.5900, lng: 22.9100 },
  ];

  const techPw = await hash("Tech2025!", 12);
  for (const t of techData) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        email: t.email,
        phone: t.phone,
        passwordHash: techPw,
        name: t.name,
        role: UserRole.TECHNICIAN,
        tenantId: lkshop.id,
      },
    });
    await prisma.technicianProfile.upsert({
      where: { userId: user.id },
      update: { latitude: t.lat, longitude: t.lng },
      create: {
        userId: user.id,
        companyId: lkshop.id,
        isOnline: true,
        isAvailable: true,
        latitude: t.lat,
        longitude: t.lng,
        specialties: [ServiceType.BATTERY_REPLACEMENT, ServiceType.BATTERY_CHARGE, ServiceType.DIAGNOSIS],
        coverageRadiusKm: 15,
      },
    });
  }
  console.log(`  ✓ 5 technicians seeded`);

  // ── Service Areas (22 zones) ──────────────────────────────────────────
  const areas = [
    { name: "Κέντρο Θεσσαλονίκης",  city: "Thessaloniki", lat: 40.6401, lng: 22.9444, r: 5 },
    { name: "Καλαμαριά",            city: "Thessaloniki", lat: 40.5914, lng: 22.9629, r: 5 },
    { name: "Σταυρούπολη",          city: "Thessaloniki", lat: 40.6700, lng: 22.9200, r: 5 },
    { name: "Αμπελόκηποι",          city: "Thessaloniki", lat: 40.6403, lng: 22.9169, r: 5 },
    { name: "Πυλαία",               city: "Thessaloniki", lat: 40.5700, lng: 22.9800, r: 5 },
    { name: "Εύοσμος",              city: "Thessaloniki", lat: 40.6756, lng: 22.8981, r: 5 },
    { name: "Κορδελιό",             city: "Thessaloniki", lat: 40.6650, lng: 22.9050, r: 5 },
    { name: "Νεάπολη",              city: "Thessaloniki", lat: 40.6500, lng: 22.9580, r: 5 },
    { name: "Τούμπα",               city: "Thessaloniki", lat: 40.6175, lng: 22.9596, r: 5 },
    { name: "Συκιές",               city: "Thessaloniki", lat: 40.6700, lng: 22.9650, r: 5 },
    { name: "Άγιος Παύλος",         city: "Thessaloniki", lat: 40.6600, lng: 22.9400, r: 5 },
    { name: "Μενεμένη",             city: "Thessaloniki", lat: 40.6900, lng: 22.9100, r: 5 },
    { name: "Σίνδος",               city: "Thessaloniki", lat: 40.7100, lng: 22.8300, r: 8 },
    { name: "Θέρμη",                city: "Thessaloniki", lat: 40.5400, lng: 23.0200, r: 8 },
    { name: "Περαία",               city: "Thessaloniki", lat: 40.5100, lng: 22.9600, r: 8 },
    { name: "Μηχανιώνα",            city: "Thessaloniki", lat: 40.4800, lng: 22.8600, r: 8 },
    { name: "Σέδες",                city: "Thessaloniki", lat: 40.5600, lng: 23.0500, r: 8 },
    { name: "Ωραιόκαστρο",          city: "Thessaloniki", lat: 40.7300, lng: 22.9200, r: 8 },
    { name: "Χαλκιδική - Βορράς",   city: "Chalkidiki",  lat: 40.4500, lng: 23.1500, r: 20 },
    { name: "Κασσάνδρα",            city: "Chalkidiki",  lat: 40.1000, lng: 23.4000, r: 20 },
    { name: "Σιθωνία",              city: "Chalkidiki",  lat: 40.1500, lng: 23.7000, r: 20 },
    { name: "Νέα Μουδανιά",         city: "Chalkidiki",  lat: 40.2400, lng: 23.2800, r: 15 },
  ];

  for (const a of areas) {
    await prisma.serviceArea.upsert({
      where: { name_city: { name: a.name, city: a.city } },
      update: {},
      create: {
        companyId: lkshop.id,
        name: a.name,
        city: a.city,
        country: "GR",
        centerLatitude: a.lat,
        centerLongitude: a.lng,
        radiusKm: a.r,
        serviceTypes: [ServiceType.BATTERY_REPLACEMENT, ServiceType.BATTERY_CHARGE, ServiceType.DIAGNOSIS],
        slaMinutes: 30,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ 22 service areas seeded`);

  // ── Pricing Rules ─────────────────────────────────────────────────────
  const pricing = [
    { type: ServiceType.BATTERY_REPLACEMENT, base: 49 },
    { type: ServiceType.BATTERY_CHARGE,      base: 19 },
    { type: ServiceType.TIRE_CHANGE,         base: 35 },
    { type: ServiceType.TIRE_REPAIR,         base: 25 },
    { type: ServiceType.DIAGNOSIS,           base: 15 },
  ];

  for (const p of pricing) {
    await prisma.pricingRule.upsert({
      where: { serviceType_tenantId: { serviceType: p.type, tenantId: lkshop.id } },
      update: {},
      create: {
        tenantId: lkshop.id,
        serviceType: p.type,
        basePrice: p.base,
        perKmSurcharge: 0.5,
        nightSurcharge: 10,
        weekendSurcharge: 5,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ Pricing rules seeded`);

  // ── Battery Catalog ───────────────────────────────────────────────────
  const batteries = [
    { sku: "VARTA-E11-74",  brand: "VARTA",  model: "Blue Dynamic E11",   tech: "LeadAcid", ah: 74, cca: 680, price: 89 },
    { sku: "VARTA-G7-95",   brand: "VARTA",  model: "Silver Dynamic G7",  tech: "AGM",      ah: 95, cca: 850, price: 159 },
    { sku: "BOSCH-S5-70",   brand: "BOSCH",  model: "S5 005",             tech: "LeadAcid", ah: 70, cca: 640, price: 79 },
    { sku: "BOSCH-S5A-70",  brand: "BOSCH",  model: "S5A 08 AGM",         tech: "AGM",      ah: 70, cca: 760, price: 149 },
    { sku: "EXIDE-EA770",   brand: "EXIDE",  model: "Excell EA770",       tech: "LeadAcid", ah: 77, cca: 760, price: 75 },
    { sku: "BERGA-BR-550",  brand: "BERGA",  model: "BaseBlock B13",      tech: "LeadAcid", ah: 55, cca: 460, price: 55 },
  ];

  for (const b of batteries) {
    await prisma.batteryCatalogItem.upsert({
      where: { sku: b.sku },
      update: {},
      create: {
        sku: b.sku,
        brand: b.brand,
        model: b.model,
        technology: b.tech,
        ah: b.ah,
        cca: b.cca,
        retailPriceEur: b.price,
        warrantyMonths: 24,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ Battery catalog seeded (${batteries.length} items)`);

  console.log("\nSeed complete!");
  console.log("────────────────────────────────────────────────");
  console.log("  Thronos root: admin@thronoschain.com / ThrAdmin2025!");
  console.log("  LK Shop admin: admin@lkshop.gr / LKAdmin2025!");
  console.log("  Technicians:   tech1-5@lkshop.gr / Tech2025!");
  console.log("  Customer SOS:  /t/lkshop");
  console.log("  Tenant admin:  /t/lkshop/admin");
  console.log("  Root admin:    /admin");
  console.log("────────────────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
