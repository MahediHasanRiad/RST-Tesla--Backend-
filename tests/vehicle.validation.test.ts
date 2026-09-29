import assert from "node:assert/strict";
import test from "node:test";
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdParamsSchema,
} from "../src/api/v1/vehicles/vehicle.validation.js";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const valid = {
  name: "Bullet",
  capacity: 3,
  availability: "OFFLINE" as const,
  images: [{ buffer: png, mimetype: "image/png" as const }],
};

test("vehicle creation accepts only safe Tesla configuration", () => {
  assert.equal(createVehicleSchema.safeParse(valid).success, true);
  assert.equal(createVehicleSchema.safeParse({ ...valid, capacity: 4 }).success, false);
  assert.equal(createVehicleSchema.safeParse({ ...valid, images: [{ buffer: Buffer.from("unsafe"), mimetype: "image/png" }] }).success, false);
  assert.equal(createVehicleSchema.safeParse({ ...valid, driverId: "other" }).success, false);
});

test("vehicle update requires a supported field", () => {
  assert.equal(updateVehicleSchema.safeParse({ availability: "ONLINE" }).success, true);
  assert.equal(
    updateVehicleSchema.safeParse({
      images: [{ buffer: png, mimetype: "image/png" as const }],
    }).success,
    true,
  );
  assert.equal(
    updateVehicleSchema.safeParse({ images: ["https://example.com/image.png"] }).success,
    false,
  );
  assert.equal(updateVehicleSchema.safeParse({}).success, false);
  assert.equal(updateVehicleSchema.safeParse({ vehicleId: "other" }).success, false);
});

test("vehicle lookup requires a strict UUID parameter", () => {
  assert.equal(
    vehicleIdParamsSchema.safeParse({
      vehicleId: "550e8400-e29b-41d4-a716-446655440000",
    }).success,
    true,
  );
  assert.equal(vehicleIdParamsSchema.safeParse({ vehicleId: "vehicle-1" }).success, false);
  assert.equal(
    vehicleIdParamsSchema.safeParse({
      vehicleId: "550e8400-e29b-41d4-a716-446655440000",
      extra: "rejected",
    }).success,
    false,
  );
});
