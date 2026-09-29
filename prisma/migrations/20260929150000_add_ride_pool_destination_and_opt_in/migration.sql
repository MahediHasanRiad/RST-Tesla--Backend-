ALTER TABLE "RidePool"
  ADD COLUMN "destinationZoneId" UUID;

ALTER TABLE "RideRequest"
  ADD COLUMN "enableRidePool" BOOLEAN NOT NULL DEFAULT false;

UPDATE "RidePool" AS pool
SET "destinationZoneId" = request."destinationZoneId"
FROM "RideRequest" AS request
WHERE request."poolId" = pool."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RidePool" WHERE "destinationZoneId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make RidePool.destinationZoneId required before backfilling all pools';
  END IF;
END $$;

ALTER TABLE "RidePool"
  ALTER COLUMN "destinationZoneId" SET NOT NULL;

ALTER TABLE "RidePool"
  ADD CONSTRAINT "RidePool_destinationZoneId_fkey"
  FOREIGN KEY ("destinationZoneId") REFERENCES "ServiceZone"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "RidePool_destinationZoneId_status_idx"
  ON "RidePool"("destinationZoneId", "status");
