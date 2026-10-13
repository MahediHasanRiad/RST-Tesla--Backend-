-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'STRIPE';

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "stripeEventId" TEXT,
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureMessage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");
CREATE UNIQUE INDEX "Payment_stripeEventId_key" ON "Payment"("stripeEventId");
