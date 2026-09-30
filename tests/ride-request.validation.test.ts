import assert from "node:assert/strict";
import test from "node:test";
import { createRideRequestSchema } from "../src/api/v1/ride-requests/validation/ride-request.validation.js";
import { closeRidePoolSchema, joinRidePoolSchema } from "../src/api/v1/ride-requests/validation/ride-pool.validation.js";
import { calculateDistanceKm } from "../src/shared/ride/distance.js";
import {
  calculateFare,
  BASE_FARE_PAISA,
  PER_KILOMETER_RATE_PAISA,
} from "../src/shared/ride/fare.js";
import { resolveRouteCorridor } from "../src/shared/ride/route-corridor.js";

const mirpurOne = "550e8400-e29b-41d4-a716-446655440000";
const mirpurTen = "550e8400-e29b-41d4-a716-446655440001";

test("ride request input defaults weather and rejects client-calculated fields", () => {
  const result = createRideRequestSchema.safeParse({
    pickupZoneId: mirpurOne,
    destinationZoneId: mirpurTen,
    seats: 1,
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.weatherCondition, "CLEAR");
  assert.equal(
    createRideRequestSchema.safeParse({
      pickupZoneId: mirpurOne,
      destinationZoneId: mirpurTen,
      seats: 1,
      passengerId: "client-controlled",
      fare: 1,
    }).success,
    false,
  );
});

test("ride request input enforces UUID and seat constraints", () => {
  assert.equal(
    createRideRequestSchema.safeParse({
      pickupZoneId: "invalid",
      destinationZoneId: mirpurTen,
      seats: 1,
    }).success,
    false,
  );
  assert.equal(
    createRideRequestSchema.safeParse({
      pickupZoneId: mirpurOne,
      destinationZoneId: mirpurTen,
      seats: 0,
    }).success,
    false,
  );
  assert.equal(
    createRideRequestSchema.safeParse({
      pickupZoneId: mirpurOne,
      destinationZoneId: mirpurTen,
      seats: 11,
    }).success,
    false,
  );
});

test("pool actions require strict UUID-only input", () => {
  assert.equal(
    closeRidePoolSchema.safeParse({ poolId: mirpurOne }).success,
    true,
  );
  assert.equal(
    closeRidePoolSchema.safeParse({ poolId: "invalid" }).success,
    false,
  );
  assert.equal(
    closeRidePoolSchema.safeParse({ poolId: mirpurOne, driverId: "client" })
      .success,
    false,
  );
  assert.equal(
    joinRidePoolSchema.safeParse({ poolId: mirpurOne, seats: 2 }).success,
    false,
  );
});

test("route corridor accepts forward trips and rejects reverse or cross-corridor trips", () => {
  assert.deepEqual(resolveRouteCorridor("mirpur-1", "mirpur-10")?.names, [
    "mirpur-1",
    "mirpur-2",
    "mirpur-10",
  ]);
  assert.equal(resolveRouteCorridor("mirpur-10", "mirpur-2"), null);
  assert.equal(resolveRouteCorridor("mirpur-1", "uttara-6"), null);
});

test("Haversine distance is deterministic", () => {
  assert.equal(calculateDistanceKm(0, 0, 0, 0), 0);
  assert.ok(Math.abs(calculateDistanceKm(0, 0, 0, 1) - 111.195) < 0.2);
});

test("fare uses the 5,000 paisa base and 1,000 paisa per kilometer", () => {
  const fare = calculateFare(6.1, "CLEAR");

  assert.equal(fare.baseFare, BASE_FARE_PAISA);
  assert.equal(fare.perKmRate, PER_KILOMETER_RATE_PAISA);
  assert.equal(fare.distanceCharge, 6_100);
  assert.equal(fare.weatherAdjustment, 0);
  assert.equal(fare.estimatedFare, 11_100);
});

test("weather surcharge is calculated by the server fare policy", () => {
  assert.equal(calculateFare(10, "RAIN").weatherAdjustment, 1_500);
  assert.equal(calculateFare(10, "HEAVY_RAIN").weatherAdjustment, 3_000);
});
