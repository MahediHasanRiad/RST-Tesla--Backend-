import assert from "node:assert/strict";
import test from "node:test";
import { listAvailableRidePoolsController } from "../src/api/v1/ride-requests/controllers/list-available-ride-pools.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/ride-request.repository.js";
import { redis } from "../src/lib/redis.js";

type RedisStub = {
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
};

const redisStub = redis as unknown as RedisStub;
const repositoryStub = rideRequestRepository as unknown as {
  findZones: (...args: unknown[]) => Promise<unknown>;
  findAvailablePoolsByRoute: (...args: unknown[]) => Promise<unknown>;
};

function responseCollector() {
  let body: unknown;
  const response = {
    req: { requestId: "test-request" },
    status() {
      return {
        json(value: unknown) {
          body = value;
          return value;
        },
      };
    },
  };
  return { response, getBody: () => body };
}

async function withStubs(
  get: RedisStub["get"],
  set: RedisStub["set"],
  findZones: (...args: unknown[]) => Promise<unknown>,
  findAvailablePoolsByRoute: (...args: unknown[]) => Promise<unknown>,
  callback: () => Promise<void>,
) {
  const originalGet = redisStub.get;
  const originalSet = redisStub.set;
  const originalFindZones = repositoryStub.findZones;
  const originalFindPools = repositoryStub.findAvailablePoolsByRoute;
  redisStub.get = get;
  redisStub.set = set;
  repositoryStub.findZones = findZones;
  repositoryStub.findAvailablePoolsByRoute = findAvailablePoolsByRoute;
  try {
    await callback();
  } finally {
    redisStub.get = originalGet;
    redisStub.set = originalSet;
    repositoryStub.findZones = originalFindZones;
    repositoryStub.findAvailablePoolsByRoute = originalFindPools;
  }
}

const pickupZone = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "mirpur-1",
  latitude: "23.793700",
  longitude: "90.365400",
};
const destinationZone = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "mirpur-10",
  latitude: "23.806900",
  longitude: "90.368700",
};

function request() {
  return {
    user: { id: "passenger-1", email: "passenger@example.com", role: "PASSENGER" },
    body: {
      pickupZoneId: pickupZone.id,
      destinationZoneId: destinationZone.id,
      seats: 1,
    },
  } as never;
}

test("available pool discovery filters by route and caches the result", async () => {
  const cache = new Map<string, string>();
  let poolReads = 0;
  const createdAt = new Date("2026-09-29T00:00:00.000Z");
  const findZones = async () => [pickupZone, destinationZone];
  const findAvailablePoolsByPickupZone = async () => {
    poolReads += 1;
    return [
      {
        id: "pool-1",
        status: "OPEN",
        reservedSeats: 1,
        createdAt,
        updatedAt: createdAt,
        pickupZone,
        vehicle: {
          id: "vehicle-1",
          name: "Bullet",
          capacity: 3,
          availability: "ONLINE",
        },
        destinationZone,
      },
    ];
  };

  await withStubs(
    async (key) => cache.get(key) ?? null,
    async (key, value) => {
      cache.set(String(key), String(value));
    },
    findZones,
    findAvailablePoolsByPickupZone,
    async () => {
      const first = responseCollector();
      await listAvailableRidePoolsController(request(), first.response as never);
      const second = responseCollector();
      await listAvailableRidePoolsController(request(), second.response as never);

      assert.equal(poolReads, 1);
      assert.equal((first.getBody() as { success: boolean }).success, true);
      assert.deepEqual(second.getBody(), JSON.parse(JSON.stringify(first.getBody())));
    },
  );
});

test("available pool discovery rejects an unsupported route", async () => {
  await withStubs(
    async () => null,
    async () => undefined,
    async () => [pickupZone, { ...destinationZone, name: "uttara-6" }],
    async () => [],
    async () => {
      await assert.rejects(
        () =>
          listAvailableRidePoolsController(
            request(),
            responseCollector().response as never,
          ),
        (error: { status: number; code: string }) =>
          error.status === 400 && error.code === "unsupported_route",
      );
    },
  );
});
