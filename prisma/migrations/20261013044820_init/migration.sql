/*
  Warnings:

  - The values [PENDING_DRIVER_ACCEPTANCE,MATCHED,DRIVER_ARRIVED,STARTED,COMPLETED,CANCELLED] on the enum `PoolStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `requestId` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[rideId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `rideId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PoolStatus_new" AS ENUM ('CLOSE', 'OPEN');
ALTER TABLE "public"."RidePool" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RidePool" ALTER COLUMN "status" TYPE "PoolStatus_new" USING ("status"::text::"PoolStatus_new");
ALTER TYPE "PoolStatus" RENAME TO "PoolStatus_old";
ALTER TYPE "PoolStatus_new" RENAME TO "PoolStatus";
DROP TYPE "public"."PoolStatus_old";
ALTER TABLE "RidePool" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_requestId_fkey";

-- DropForeignKey
ALTER TABLE "RideRequest" DROP CONSTRAINT "RideRequest_passengerId_fkey";

-- DropIndex
DROP INDEX "Payment_requestId_key";

-- DropIndex
DROP INDEX "RidePool_destinationZoneId_status_idx";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "requestId",
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "rideId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "RidePool" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RideRequest" ADD COLUMN     "baseFarePaisa" INTEGER,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "distanceFarePaisa" INTEGER,
ADD COLUMN     "matchedAt" TIMESTAMP(3),
ADD COLUMN     "poolDiscountPaisa" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ridePoolId" UUID,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "availability" SET DEFAULT 'ONLINE';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_rideId_key" ON "Payment"("rideId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "RideRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
