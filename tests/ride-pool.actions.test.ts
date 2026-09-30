import assert from "node:assert/strict";
import test from "node:test";
import { joinRidePoolController } from "../src/api/v1/ride-requests/controllers/join-ride-pool.controller.js";
import { openRidePoolController } from "../src/api/v1/drivers/controllers/open-ride-pool.controller.js";
import { closeRidePoolController } from "../src/api/v1/drivers/controllers/close-ride-pool.controller.js";
import { ridePoolRepository } from "../src/api/v1/ride-requests/repository/ride-pool.repository.js";
import { redis } from "../src/lib/redis.js";
import { vehicleRepository } from "../src/api/v1/vehicles/vehicle.repository.js";

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
  const vehicleRepo = vehicleRepository as unknown as Record<string, unknown>;
  const originalFindDriverByUserId = vehicleRepo.findDriverByUserId;
  vehicleRepo.findDriverByUserId = async () => ({ id: "driver-1" });
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
      try {
        await openRidePoolController(
          {
            user: { id: "driver-1", role: "DRIVER" },
            body: { pickupZoneId, destinationZoneId },
          } as never,
          collected.response as never,
        );
      } finally {
        vehicleRepo.findDriverByUserId = originalFindDriverByUserId;
      }
    },
  );
  assert.equal(collected.getStatus(), 201);
  assert.equal((collected.getBody() as { success: boolean }).success, true);
});

test("pool opening maps validation, vehicle, and duplicate-pool conflicts", async () => {
  const vehicleRepo = vehicleRepository as unknown as Record<string, unknown>;
  const originalFindDriverByUserId = vehicleRepo.findDriverByUserId;
  vehicleRepo.findDriverByUserId = async () => ({ id: "driver-1" });
  try {
    for (const [kind, status, code] of [
      ["vehicle_not_found", 404, "vehicle_not_found"],
      ["vehicle_offline", 409, "vehicle_offline"],
      ["active_pool_exists", 409, "active_pool_exists"],
    ] as const) {
      await withRepositoryStubs(
        {
          findZones: async () => [
            { id: pickupZoneId, name: "mirpur-1" },
            { id: destinationZoneId, name: "mirpur-10" },
          ],
          createForDriver: async () => ({ kind }),
        },
        async () => {
          await assert.rejects(
            () =>
              openRidePoolController(
                {
                  user: { id: "driver-1", role: "DRIVER" },
                  body: { pickupZoneId, destinationZoneId },
                } as never,
                responseCollector().response as never,
              ),
            (error: { status: number; code: string }) =>
              error.status === status && error.code === code,
          );
        },
      );
    }
  } finally {
    vehicleRepo.findDriverByUserId = originalFindDriverByUserId;
  }
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

test("owning driver closes an open pool", async () => {
  const collected = responseCollector();
  const redisClient = redis as unknown as { incr: (key: string) => Promise<number> };
  const redisExpiry = redis as unknown as { expire: (key: string, seconds: number) => Promise<number> };
  const originalIncr = redisClient.incr;
  const originalExpire = redisExpiry.expire;
  let invalidatedKey = "";
  let invalidatedTtl = 0;
  redisClient.incr = async (key) => {
    invalidatedKey = key;
    return 1;
  };
  redisExpiry.expire = async (_key, seconds) => {
    invalidatedTtl = seconds;
    return 1;
  };
  await withRepositoryStubs(
    {
      closeForDriver: async (driverUserId, selectedPoolId) => {
        assert.equal(driverUserId, "driver-1");
        assert.equal(selectedPoolId, poolId);
        return {
          kind: "closed",
          pool: {
            id: poolId,
            status: "CLOSE",
            reservedSeats: 2,
            pickupZone: { id: pickupZoneId },
            destinationZone: { id: destinationZoneId },
          },
        };
      },
    },
    async () => {
      try {
        await closeRidePoolController(
          {
            user: { id: "driver-1", role: "DRIVER" },
            body: { poolId },
          } as never,
          collected.response as never,
        );
      } finally {
        redisClient.incr = originalIncr;
        redisExpiry.expire = originalExpire;
      }
    },
  );
  assert.equal(collected.getStatus(), 200);
  assert.equal(
    (collected.getBody() as { data: { status: string } }).data.status,
    "CLOSE",
  );
  assert.equal(
    invalidatedKey,
    `ride-pools:available:v1:version:${pickupZoneId}:${destinationZoneId}`,
  );
  assert.equal(invalidatedTtl, 120);
});

test("pool close maps ownership and lifecycle conflicts", async () => {
  for (const [kind, status, code] of [
    ["forbidden", 403, "forbidden"],
    ["pool_closed", 409, "ride_pool_not_open"],
    ["pool_not_found", 404, "ride_pool_not_found"],
  ] as const) {
    await withRepositoryStubs(
      { closeForDriver: async () => ({ kind }) },
      async () => {
        await assert.rejects(
          () =>
            closeRidePoolController(
              {
                user: { id: "driver-1", role: "DRIVER" },
                body: { poolId },
              } as never,
              responseCollector().response as never,
            ),
          (error: { status: number; code: string }) =>
            error.status === status && error.code === code,
        );
      },
    );
  }
});

test("Redis invalidation failure does not undo a successful close", async () => {
  const redisClient = redis as unknown as { incr: (key: string) => Promise<number> };
  const originalIncr = redisClient.incr;
  redisClient.incr = async () => {
    throw new Error("redis unavailable");
  };
  try {
    await withRepositoryStubs(
      {
        closeForDriver: async () => ({
          kind: "closed" as const,
          pool: {
            id: poolId,
            status: "CLOSE",
            pickupZone: { id: pickupZoneId },
            destinationZone: { id: destinationZoneId },
          },
        }),
      },
      async () => {
        const collected = responseCollector();
        await closeRidePoolController(
          {
            user: { id: "driver-1", role: "DRIVER" },
            body: { poolId },
          } as never,
          collected.response as never,
        );
        assert.equal(collected.getStatus(), 200);
        assert.equal(
          (collected.getBody() as { data: { status: string } }).data.status,
          "CLOSE",
        );
      },
    );
  } finally {
    redisClient.incr = originalIncr;
  }
});

test("pool joins reject closed, incompatible, and over-capacity pools", async () => {
  for (const [kind, code] of [
    ["pool_closed", "ride_pool_not_open"],
    ["route_mismatch", "ride_pool_route_mismatch"],
    ["capacity_conflict", "ride_pool_capacity_conflict"],
  ] as const) {
    await withRepositoryStubs(
      { joinForPassenger: async () => ({ kind }) },
      async () => {
        await assert.rejects(
          () =>
            joinRidePoolController(
              {
                user: { id: "passenger-1", role: "PASSENGER" },
                params: { rideRequestId },
                body: { poolId },
              } as never,
              responseCollector().response as never,
            ),
          (error: { status: number; code: string }) =>
            error.status === 409 && error.code === code,
        );
      },
    );
  }
});

test("concurrent final-seat joins allow only the capacity-fitting action", async () => {
  let reservedSeats = 2;
  await withRepositoryStubs(
    {
      joinForPassenger: async () => {
        if (reservedSeats + 1 > 3) return { kind: "capacity_conflict" };
        reservedSeats += 1;
        return {
          kind: "joined",
          pool: { id: poolId, reservedSeats },
          request: { id: rideRequestId, poolId, status: "PENDING_DRIVER_ACCEPTANCE" },
        };
      },
    },
    async () => {
      const results = await Promise.allSettled([
        joinRidePoolController(
          {
            user: { id: "passenger-1", role: "PASSENGER" },
            params: { rideRequestId },
            body: { poolId },
          } as never,
          responseCollector().response as never,
        ),
        joinRidePoolController(
          {
            user: { id: "passenger-2", role: "PASSENGER" },
            params: { rideRequestId },
            body: { poolId },
          } as never,
          responseCollector().response as never,
        ),
      ]);

      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      assert.equal(reservedSeats, 3);
    },
  );
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

  await assert.rejects(
    () =>
      closeRidePoolController(
        {
          user: { id: "passenger-1", role: "PASSENGER" },
          body: { poolId },
        } as never,
        responseCollector().response as never,
      ),
    (error: { status: number; code: string }) =>
      error.status === 403 && error.code === "forbidden",
  );
});
