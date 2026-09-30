DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RidePool" WHERE "vehicleId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require RidePool.vehicleId while null pools exist';
  END IF;
END $$;

ALTER TABLE "RidePool"
ALTER COLUMN "vehicleId" SET NOT NULL;
