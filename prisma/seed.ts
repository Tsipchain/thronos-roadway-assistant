import { PrismaClient, ServiceType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@batterysos.gr" },
    update: {},
    create: {
      email: "admin@batterysos.gr",
      phone: "+302100000000",
      name: "Admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  const technician = await prisma.user.upsert({
    where: { email: "tech@batterysos.gr" },
    update: {},
    create: {
      email: "tech@batterysos.gr",
      phone: "+306900000000",
      name: "Γιώργος Τεχνικός",
      role: "TECHNICIAN",
      passwordHash,
      walletAddress: "0x0000000000000000000000000000000000000001",
    },
  });

  await prisma.technicianProfile.upsert({
    where: { userId: technician.id },
    update: {
      isOnline: true,
      isAvailable: true,
      latitude: 37.9838,
      longitude: 23.7275,
    },
    create: {
      userId: technician.id,
      isOnline: true,
      isAvailable: true,
      latitude: 37.9838,
      longitude: 23.7275,
      rating: 4.9,
      specialties: [ServiceType.BATTERY_REPLACEMENT, ServiceType.BATTERY_CHARGE, ServiceType.TIRE_CHANGE],
      coverageRadiusKm: 15,
      vehiclePlate: "SOS-1000",
      inventoryNote: "AGM 70Ah, EFB 60Ah, standard 45Ah/55Ah/74Ah, jack, compressor",
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      phone: "+306911111111",
      name: "Demo Πελάτης",
      role: "CUSTOMER",
      passwordHash,
    },
  });

  await prisma.vehicle.upsert({
    where: {
      userId_licensePlate: {
        userId: customer.id,
        licensePlate: "ΙΧΑ1234",
      },
    },
    update: {},
    create: {
      userId: customer.id,
      licensePlate: "ΙΧΑ1234",
      make: "Volkswagen",
      model: "Golf",
      year: 2018,
      engineType: "1.4 TSI",
      batteryType: "AGM",
      batteryAh: 70,
      tireSize: "205/55R16",
    },
  });

  const pricingRules = [
    { serviceType: ServiceType.BATTERY_REPLACEMENT, basePrice: 40 },
    { serviceType: ServiceType.BATTERY_CHARGE, basePrice: 30 },
    { serviceType: ServiceType.TIRE_CHANGE, basePrice: 35 },
    { serviceType: ServiceType.TIRE_REPAIR, basePrice: 30 },
    { serviceType: ServiceType.DIAGNOSIS, basePrice: 25 },
  ];

  for (const rule of pricingRules) {
    await prisma.pricingRule.upsert({
      where: { serviceType: rule.serviceType },
      update: { basePrice: rule.basePrice },
      create: rule,
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
