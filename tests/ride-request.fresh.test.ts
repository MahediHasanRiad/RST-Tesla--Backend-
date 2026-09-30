import assert from "node:assert/strict";
import test from "node:test";
import { createFreshRideRequestController } from "../src/api/v1/ride-requests/controllers/create-fresh-ride-request.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/repository/ride-request.repository.js";

const pickupZoneId = "550e8400-e29b-41d4-a716-446655440000";
const destinationZoneId = "550e8400-e29b-41d4-a716-446655440001";
const vehicleId = "550e8400-e29b-41d4-a716-446655440002";

function responseCollector() {
  let body: unknown;
  let statusCode: number | undefined;
  const response = {
    req: { requestId: "test-request" },
    status(status: number) {
      statusCode = status;
      return {
        json(value: unknown) {
          body = value;
          return value;
        },
      };
    },
  };
  return { response, getBody: () => body, getStatus: () => statusCode };
}

async function withRepositoryStub(
  createFresh: (...args: unknown[]) => Promise<unknown>,
  callback: () => Promise<void>,
) {
  const repository = rideRequestRepository as unknown as Record<string, unknown>;
  const original = {
    createFresh: repository.createFresh,
    findZones: repository.findZones,
  };
  repository.createFresh = createFresh;
  repository.findZones = async () => zones;
  try {
    await callback();
  } finally {
    repository.createFresh = original.createFresh;
    repository.findZones = original.findZones;
  }
}

const zones = [
  { id: pickupZoneId, name: "mirpur-1", latitude: 23.7937, longitude: 90.3654 },
  { id: destinationZoneId, name: "mirpur-10", latitude: 23.8069, longitude: 90.3687 },
];

function request(enableRidePool: boolean, vehicle = vehicleId) {
  return {
    user: { id: "passenger-1", role: "PASSENGER" },
    body: {
      pickupZoneId,
      destinationZoneId,
      seats: 1,
      enableRidePool,
      ...(vehicle ? { vehicleId: vehicle } : {}),
    },
  } as never;
}

test("fresh pooled ride creates an open route pool with reserved seats", async () => {
  const collected = responseCollector();
  await withRepositoryStub(
    async (passengerId, input, farePaisa) => {
      assert.equal(passengerId, "passenger-1");
      assert.equal(input.enableRidePool, true);
      assert.equal(input.vehicleId, vehicleId);
      assert.ok(Number.isInteger(farePaisa));
      return {
        kind: "created",
        pool: {
          id: "pool-1",
          status: "OPEN",
          reservedSeats: 1,
          pickupZone: zones[0],
          destinationZone: zones[1],
          vehicle: { id: vehicleId, capacity: 3, availability: "ONLINE" },
        },
        request: {
          id: "request-1",
          requestedSeats: 1,
          enableRidePool: true,
          status: "PENDING_DRIVER_ACCEPTANCE",
          pickupZone: zones[0],
          destinationZone: zones[1],
          createdAt: new Date("2026-09-30T00:00:00.000Z"),
        },
      };
    },
    async () => {
      await createFreshRideRequestController(
        request(true, vehicleId),
        collected.response as never,
      );
    },
  );

  const data = (collected.getBody() as { data: { pool: { status: string; reservedSeats: number } } }).data;
  assert.equal(collected.getStatus(), 201);
  assert.equal(data.pool.status, "OPEN");
  assert.equal(data.pool.reservedSeats, 1);
});

test("fresh private ride creates a closed route pool", async () => {
  const collected = responseCollector();
  await withRepositoryStub(
    async (_passengerId, input) => {
      assert.equal(input.enableRidePool, false);
      assert.equal(input.vehicleId, vehicleId);
      return {
        kind: "created",
        pool: {
          id: "pool-2",
          status: "CLOSE",
          reservedSeats: 1,
          pickupZone: zones[0],
          destinationZone: zones[1],
          vehicle: { id: vehicleId, capacity: 3, availability: "ONLINE" },
        },
        request: {
          id: "request-2",
          requestedSeats: 1,
          enableRidePool: false,
          status: "PENDING_DRIVER_ACCEPTANCE",
          pickupZone: zones[0],
          destinationZone: zones[1],
          createdAt: new Date("2026-09-30T00:00:00.000Z"),
        },
      };
    },
    async () => {
      await createFreshRideRequestController(
        request(false, vehicleId),
        collected.response as never,
      );
    },
  );

  const data = (collected.getBody() as { data: { pool: { status: string; vehicle: unknown } } }).data;
  assert.equal(collected.getStatus(), 201);
  assert.equal(data.pool.status, "CLOSE");
  assert.equal((data.pool.vehicle as { id: string }).id, vehicleId);
});
