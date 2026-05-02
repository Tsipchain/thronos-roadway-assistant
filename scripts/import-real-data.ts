import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";
import { PrismaClient, ServiceType } from "@prisma/client";

const prisma = new PrismaClient();
const dataDir = process.argv[2] || process.env.REAL_DATA_DIR || "data/import";
const templateDir = "data/templates";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  if (rows.length === 0) return [];
  const [headers, ...body] = rows;
  return body.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function readCsv(name: string): Record<string, string>[] {
  const file = join(dataDir, name);
  const fallback = join(templateDir, name);
  const path = existsSync(file) ? file : fallback;
  if (!existsSync(path)) return [];
  return parseCsv(readFileSync(path, "utf8"));
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function num(value: string | undefined): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) throw new Error(`Invalid number: ${value}`);
  return parsed;
}

function bool(value: string | undefined, fallback = true): boolean {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return fallback;
  return ["1", "true", "yes", "y", "active"].includes(trimmed);
}

function serviceTypes(value: string | undefined): ServiceType[] {
  const raw = optional(value);
  if (!raw) return [];
  return raw.split("|").map((entry) => {
    const cleaned = entry.trim() as keyof typeof ServiceType;
    if (!(cleaned in ServiceType)) throw new Error(`Invalid ServiceType: ${entry}`);
    return ServiceType[cleaned];
  });
}

async function importPartners() {
  for (const row of readCsv("partners.csv")) {
    await prisma.partnerCompany.upsert({
      where: { name: row.name },
      update: {
        vatNumber: optional(row.vatNumber),
        phone: optional(row.phone),
        email: optional(row.email),
        billingAddress: optional(row.billingAddress),
        status: optional(row.status) ?? "ACTIVE",
      },
      create: {
        name: row.name,
        vatNumber: optional(row.vatNumber),
        phone: optional(row.phone),
        email: optional(row.email),
        billingAddress: optional(row.billingAddress),
        status: optional(row.status) ?? "ACTIVE",
      },
    });
  }
}

async function importServiceAreas() {
  for (const row of readCsv("service_areas.csv")) {
    const company = optional(row.companyName)
      ? await prisma.partnerCompany.findUnique({ where: { name: row.companyName } })
      : null;

    await prisma.serviceArea.upsert({
      where: { name_city: { name: row.name, city: row.city } },
      update: {
        companyId: company?.id,
        country: optional(row.country) ?? "GR",
        centerLatitude: num(row.centerLatitude)!,
        centerLongitude: num(row.centerLongitude)!,
        radiusKm: num(row.radiusKm) ?? 15,
        serviceTypes: serviceTypes(row.serviceTypes),
        slaMinutes: num(row.slaMinutes) ?? 30,
        isActive: bool(row.isActive, true),
      },
      create: {
        companyId: company?.id,
        name: row.name,
        city: row.city,
        country: optional(row.country) ?? "GR",
        centerLatitude: num(row.centerLatitude)!,
        centerLongitude: num(row.centerLongitude)!,
        radiusKm: num(row.radiusKm) ?? 15,
        serviceTypes: serviceTypes(row.serviceTypes),
        slaMinutes: num(row.slaMinutes) ?? 30,
        isActive: bool(row.isActive, true),
      },
    });
  }
}

async function importTechnicians() {
  const passwordHash = await bcrypt.hash(process.env.DEFAULT_TECHNICIAN_PASSWORD || "ChangeMe123!", 10);

  for (const row of readCsv("technicians.csv")) {
    const company = optional(row.companyName)
      ? await prisma.partnerCompany.findUnique({ where: { name: row.companyName } })
      : null;

    const user = await prisma.user.upsert({
      where: { email: row.email },
      update: {
        phone: row.phone,
        name: row.name,
        walletAddress: optional(row.walletAddress),
      },
      create: {
        email: row.email,
        phone: row.phone,
        name: row.name,
        role: "TECHNICIAN",
        passwordHash,
        walletAddress: optional(row.walletAddress),
      },
    });

    await prisma.technicianProfile.upsert({
      where: { userId: user.id },
      update: {
        companyId: company?.id,
        vehiclePlate: optional(row.vehiclePlate),
        latitude: num(row.latitude),
        longitude: num(row.longitude),
        coverageRadiusKm: num(row.coverageRadiusKm) ?? 15,
        specialties: serviceTypes(row.specialties),
        inventoryNote: optional(row.inventoryNote),
        isOnline: bool(row.isOnline, false),
        isAvailable: true,
      },
      create: {
        userId: user.id,
        companyId: company?.id,
        vehiclePlate: optional(row.vehiclePlate),
        latitude: num(row.latitude),
        longitude: num(row.longitude),
        coverageRadiusKm: num(row.coverageRadiusKm) ?? 15,
        specialties: serviceTypes(row.specialties),
        inventoryNote: optional(row.inventoryNote),
        isOnline: bool(row.isOnline, false),
        isAvailable: true,
      },
    });
  }
}

async function importBatteries() {
  for (const row of readCsv("batteries.csv")) {
    await prisma.batteryCatalogItem.upsert({
      where: { sku: row.sku },
      update: {
        brand: row.brand,
        model: row.model,
        technology: row.technology,
        voltage: num(row.voltage) ?? 12,
        ah: num(row.ah)!,
        cca: num(row.cca),
        lengthMm: num(row.lengthMm),
        widthMm: num(row.widthMm),
        heightMm: num(row.heightMm),
        polarity: optional(row.polarity),
        warrantyMonths: num(row.warrantyMonths) ?? 24,
        retailPriceEur: num(row.retailPriceEur)!,
        partnerCostEur: num(row.partnerCostEur),
        platformFeeEur: num(row.platformFeeEur) ?? 0,
        stockNote: optional(row.stockNote),
        isActive: bool(row.isActive, true),
      },
      create: {
        sku: row.sku,
        brand: row.brand,
        model: row.model,
        technology: row.technology,
        voltage: num(row.voltage) ?? 12,
        ah: num(row.ah)!,
        cca: num(row.cca),
        lengthMm: num(row.lengthMm),
        widthMm: num(row.widthMm),
        heightMm: num(row.heightMm),
        polarity: optional(row.polarity),
        warrantyMonths: num(row.warrantyMonths) ?? 24,
        retailPriceEur: num(row.retailPriceEur)!,
        partnerCostEur: num(row.partnerCostEur),
        platformFeeEur: num(row.platformFeeEur) ?? 0,
        stockNote: optional(row.stockNote),
        isActive: bool(row.isActive, true),
      },
    });
  }
}

async function importTyres() {
  for (const row of readCsv("tyres.csv")) {
    await prisma.tyreCatalogItem.upsert({
      where: { sku: row.sku },
      update: {
        brand: row.brand,
        model: row.model,
        size: row.size,
        season: row.season,
        loadIndex: optional(row.loadIndex),
        speedIndex: optional(row.speedIndex),
        warrantyMonths: num(row.warrantyMonths) ?? 12,
        retailPriceEur: num(row.retailPriceEur)!,
        partnerCostEur: num(row.partnerCostEur),
        platformFeeEur: num(row.platformFeeEur) ?? 0,
        stockNote: optional(row.stockNote),
        isActive: bool(row.isActive, true),
      },
      create: {
        sku: row.sku,
        brand: row.brand,
        model: row.model,
        size: row.size,
        season: row.season,
        loadIndex: optional(row.loadIndex),
        speedIndex: optional(row.speedIndex),
        warrantyMonths: num(row.warrantyMonths) ?? 12,
        retailPriceEur: num(row.retailPriceEur)!,
        partnerCostEur: num(row.partnerCostEur),
        platformFeeEur: num(row.platformFeeEur) ?? 0,
        stockNote: optional(row.stockNote),
        isActive: bool(row.isActive, true),
      },
    });
  }
}

async function importFitments() {
  for (const row of readCsv("vehicle_fitments.csv")) {
    const sourceKey = [row.make, row.model, row.yearFrom, row.yearTo, row.engineType, row.batterySku, row.tyreSku, row.tyreSize]
      .map((part) => (part || "").trim().toLowerCase())
      .join("::");

    await prisma.vehicleFitmentRule.upsert({
      where: { sourceKey },
      update: {
        make: row.make,
        model: row.model,
        yearFrom: num(row.yearFrom),
        yearTo: num(row.yearTo),
        engineType: optional(row.engineType),
        batterySku: optional(row.batterySku),
        tyreSku: optional(row.tyreSku),
        tyreSize: optional(row.tyreSize),
        notes: optional(row.notes),
      },
      create: {
        sourceKey,
        make: row.make,
        model: row.model,
        yearFrom: num(row.yearFrom),
        yearTo: num(row.yearTo),
        engineType: optional(row.engineType),
        batterySku: optional(row.batterySku),
        tyreSku: optional(row.tyreSku),
        tyreSize: optional(row.tyreSize),
        notes: optional(row.notes),
      },
    });
  }
}

async function main() {
  console.log(`Importing real data from ${existsSync(dataDir) ? dataDir : templateDir}`);
  await importPartners();
  await importServiceAreas();
  await importBatteries();
  await importTyres();
  await importFitments();
  await importTechnicians();
  console.log("Real data import completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
