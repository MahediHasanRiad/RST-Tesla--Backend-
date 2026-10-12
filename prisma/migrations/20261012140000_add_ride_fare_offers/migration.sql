CREATE TYPE "RideFareOfferStatus" AS ENUM ('CURRENT', 'REPLACED');

CREATE TABLE "RideFareOffer" (
    "id" UUID NOT NULL,
    "rideRequestId" UUID NOT NULL,
    "offerVersion" INTEGER NOT NULL,
    "amountPaisa" INTEGER NOT NULL,
    "proposedById" UUID,
    "passengerAcceptedAt" TIMESTAMP(3),
    "driverAcceptedAt" TIMESTAMP(3),
    "status" "RideFareOfferStatus" NOT NULL DEFAULT 'CURRENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideFareOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RideFareOffer_rideRequestId_offerVersion_key"
  ON "RideFareOffer"("rideRequestId", "offerVersion");
CREATE UNIQUE INDEX "RideFareOffer_one_current_per_request_key"
  ON "RideFareOffer"("rideRequestId")
  WHERE "status" = 'CURRENT';
CREATE INDEX "RideFareOffer_rideRequestId_status_idx"
  ON "RideFareOffer"("rideRequestId", "status");

ALTER TABLE "RideFareOffer"
  ADD CONSTRAINT "RideFareOffer_rideRequestId_fkey"
  FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideFareOffer"
  ADD CONSTRAINT "RideFareOffer_proposedById_fkey"
  FOREIGN KEY ("proposedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RideFareOffer" (
  "id",
  "rideRequestId",
  "offerVersion",
  "amountPaisa",
  "proposedById",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text)::uuid,
  request."id",
  1,
  request."farePaisa",
  request."passengerId",
  'CURRENT'::"RideFareOfferStatus",
  request."createdAt",
  request."updatedAt"
FROM "RideRequest" AS request
WHERE request."status" IN ('REQUESTED', 'PENDING_DRIVER_ACCEPTANCE')
  AND request."farePaisa" IS NOT NULL
  AND request."farePaisa" > 0;
