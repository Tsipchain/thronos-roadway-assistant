import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

// Cache in globalThis for ALL envs — prevents connection churn on hot reload
// and ensures a single client per process on Railway/long-running servers.
export const prisma = globalForPrisma.prisma ?? makePrisma();
globalForPrisma.prisma = prisma;

if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}
