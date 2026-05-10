-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'OFFSET');

-- CreateTable
CREATE TABLE "TenantPayout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT,
    "grossAmountEur" DOUBLE PRECISION NOT NULL,
    "feePercent" DOUBLE PRECISION NOT NULL,
    "feeAmountEur" DOUBLE PRECISION NOT NULL,
    "netAmountEur" DOUBLE PRECISION NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "stripeTransferId" TEXT,
    "cryptoTxHash" TEXT,
    "bankRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPayout_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PartnerCompany" ADD COLUMN "payoutMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
ADD COLUMN "payoutIban" TEXT,
ADD COLUMN "payoutBic" TEXT,
ADD COLUMN "payoutWalletAddress" TEXT,
ADD COLUMN "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 8;

-- CreateIndex
CREATE INDEX "TenantPayout_tenantId_status_idx" ON "TenantPayout"("tenantId", "status");

-- CreateIndex
CREATE INDEX "TenantPayout_createdAt_idx" ON "TenantPayout"("createdAt");

-- AddForeignKey
ALTER TABLE "TenantPayout" ADD CONSTRAINT "TenantPayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PartnerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
