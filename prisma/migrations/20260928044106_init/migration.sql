-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PASSENGER', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VehicleAvailability" AS ENUM ('OFFLINE', 'ONLINE');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'PENDING_DRIVER_ACCEPTANCE', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RideRequestStatus" AS ENUM ('REQUESTED', 'PENDING_DRIVER_ACCEPTANCE', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TESLA_PAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "experienceYears" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "availability" "VehicleAvailability" NOT NULL DEFAULT 'OFFLINE',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceZone" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RidePool" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "pickupZoneId" UUID NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "reservedSeats" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RidePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideRequest" (
    "id" UUID NOT NULL,
    "passengerId" UUID NOT NULL,
    "poolId" UUID,
    "pickupZoneId" UUID NOT NULL,
    "destinationZoneId" UUID NOT NULL,
    "requestedSeats" INTEGER NOT NULL,
    "status" "RideRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "farePaisa" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideStatusHistory" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "fromStatus" "RideRequestStatus",
    "toStatus" "RideRequestStatus" NOT NULL,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_driverId_key" ON "Vehicle"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceZone_name_key" ON "ServiceZone"("name");

-- CreateIndex
CREATE INDEX "RidePool_vehicleId_status_idx" ON "RidePool"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "RidePool_pickupZoneId_status_idx" ON "RidePool"("pickupZoneId", "status");

-- CreateIndex
CREATE INDEX "RideRequest_pickupZoneId_status_idx" ON "RideRequest"("pickupZoneId", "status");

-- CreateIndex
CREATE INDEX "RideRequest_passengerId_createdAt_idx" ON "RideRequest"("passengerId", "createdAt");

-- CreateIndex
CREATE INDEX "RideStatusHistory_requestId_createdAt_idx" ON "RideStatusHistory"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_requestId_key" ON "Payment"("requestId");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RidePool" ADD CONSTRAINT "RidePool_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RidePool" ADD CONSTRAINT "RidePool_pickupZoneId_fkey" FOREIGN KEY ("pickupZoneId") REFERENCES "ServiceZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "RidePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_pickupZoneId_fkey" FOREIGN KEY ("pickupZoneId") REFERENCES "ServiceZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_destinationZoneId_fkey" FOREIGN KEY ("destinationZoneId") REFERENCES "ServiceZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideStatusHistory" ADD CONSTRAINT "RideStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RideRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideStatusHistory" ADD CONSTRAINT "RideStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RideRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
