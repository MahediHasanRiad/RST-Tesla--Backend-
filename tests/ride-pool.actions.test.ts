import assert from "node:assert/strict";
import test from "node:test";
import { joinRidePoolController } from "../src/api/v1/ride-requests/controllers/join-ride-pool.controller.js";
import { openRidePoolController } from "../src/api/v1/ride-requests/controllers/open-ride-pool.controller.js";
import { ridePoolRepository } from "../src/api/v1/ride-requests/ride-pool.repository.js";

const pickupZoneId = "550e8400-e29b-41d4-a716-446655440000";
const destinationZoneId = "550e8400-e29b-41d4-a716-446655440001";
const rideRequestId = "550e8400-e29b-41d4-a716-446655440002";
const poolId = "550e8400-e29b-41d4-a716-446655440003";

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

async function withRepositoryStubs(
  stubs: Partial<Record<string, (...args: unknown[]) => Promise<unknown>>>,
  callback: () => Promise<void>,
) {
  const repository = ridePoolRepository as unknown as Record<string, unknown>;
  const originals = new Map<string, unknown>();
  for (const [name, implementation] of Object.entries(stubs)) {
    originals.set(name, repository[name]);
    repository[name] = implementation;
  }
  try {
    await callback();
  } finally {
    for (const [name, implementation] of originals) {
      repository[name] = implementation;
    }
  }
}

test("driver can open an online directional pool", async () => {
  const collected = responseCollector();
  await withRepositoryStubs(
    {
      findZones: async () => [
        { id: pickupZoneId, name: "mirpur-1" },
        { id: destinationZoneId, name: "mirpur-10" },
      ],
      createForDriver: async (driverId, input) => {
        assert.equal(driverId, "driver-1");
        assert.deepEqual(input, { pickupZoneId, destinationZoneId });
        return { kind: "created", pool: { id: poolId, status: "OPEN" } };
      },
    },
    async () => {
      await openRidePoolController(
        {
          user: { id: "driver-1", role: "DRIVER" },
          body: { pickupZoneId, destinationZoneId },
        } as never,
        collected.response as never,
      );
    },
  );
  assert.equal(collected.getStatus(), 201);
  assert.equal((collected.getBody() as { success: boolean }).success, true);
});

test("passenger joins a pool using the stored ride-request seats", async () => {
  const collected = responseCollector();
  await withRepositoryStubs(
    {
      joinForPassenger: async (passengerId, requestId, selectedPoolId) => {
        assert.equal(passengerId, "passenger-1");
        assert.equal(requestId, rideRequestId);
        assert.equal(selectedPoolId, poolId);
        return {
          kind: "joined",
          pool: { id: poolId, reservedSeats: 2 },
          request: {
            id: rideRequestId,
            poolId,
            status: "PENDING_DRIVER_ACCEPTANCE",
          },
        };
      },
    },
    async () => {
      await joinRidePoolController(
        {
          user: { id: "passenger-1", role: "PASSENGER" },
          params: { rideRequestId },
          body: { poolId },
        } as never,
        collected.response as never,
      );
    },
  );
  assert.equal(collected.getStatus(), 200);
  assert.equal((collected.getBody() as { success: boolean }).success, true);
});

test("pool actions enforce actor roles", async () => {
  await assert.rejects(
    () =>
      openRidePoolController(
        { user: { id: "passenger-1", role: "PASSENGER" }, body: {} } as never,
        responseCollector().response as never,
      ),
    (error: { status: number; code: string }) =>
      error.status === 403 && error.code === "forbidden",
  );

  await assert.rejects(
    () =>
      joinRidePoolController(
        {
          user: { id: "driver-1", role: "DRIVER" },
          params: { rideRequestId },
          body: { poolId },
        } as never,
        responseCollector().response as never,
      ),
    (error: { status: number; code: string }) =>
      error.status === 403 && error.code === "forbidden",
  );
});
