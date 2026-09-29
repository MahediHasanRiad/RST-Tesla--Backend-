-- Retain operational history while allowing account PII to be permanently deleted.
ALTER TABLE "User" ADD COLUMN "avatarPublicId" TEXT;

ALTER TABLE "Driver" DROP CONSTRAINT "Driver_userId_fkey";
ALTER TABLE "Driver" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RideRequest" DROP CONSTRAINT "RideRequest_passengerId_fkey";
ALTER TABLE "RideRequest" ALTER COLUMN "passengerId" DROP NOT NULL;
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_passengerId_fkey"
  FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
