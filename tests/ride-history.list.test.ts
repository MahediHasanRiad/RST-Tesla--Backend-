import assert from "node:assert/strict";
import test from "node:test";
import { listDriverCompletedRideRequestsController } from "../src/api/v1/ride-requests/controllers/list-driver-completed-ride-requests.controller.js";
import { listDriverRideRequestsController } from "../src/api/v1/ride-requests/controllers/list-driver-ride-requests.controller.js";
import { listPassengerCompletedRideRequestsController } from "../src/api/v1/ride-requests/controllers/list-passenger-completed-ride-requests.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/ride-request.repository.js";
import { redis } from "../src/lib/redis.js";

type RedisStub = {
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
};

const redisStub = redis as unknown as RedisStub;
const repositoryStub = rideRequestRepository as unknown as Record<string, unknown>;

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
  stubs: Record<string, (...args: unknown[]) => Promise<unknown>>,
  get: RedisStub["get"],
  set: RedisStub["set"],
  callback: () => Promise<void>,
) {
  const originalGet = redisStub.get;
  const originalSet = redisStub.set;
  const originals = new Map<string, unknown>();
  redisStub.get = get;
  redisStub.set = set;
  for (const [name, implementation] of Object.entries(stubs)) {
    originals.set(name, repositoryStub[name]);
    repositoryStub[name] = implementation;
  }
  try {
    await callback();
  } finally {
    redisStub.get = originalGet;
    redisStub.set = originalSet;
    for (const [name, implementation] of originals) {
      repositoryStub[name] = implementation;
    }
  }
}

const driverRequest = {
  user: { id: "driver-1", email: "driver@example.com", role: "DRIVER" },
  query: {},
} as never;

const passengerRequest = {
  user: { id: "passenger-1", email: "passenger@example.com", role: "PASSENGER" },
  query: { page: "2", limit: "10" },
} as never;

test("driver request list is scoped to the authenticated driver and cached", async () => {
  const cache = new Map<string, string>();
  let reads = 0;
  const createdAt = new Date("2026-09-29T00:00:00.000Z");

  await withStubs(
    {
      findPageByDriver: async (driverId) => {
        reads += 1;
        assert.equal(driverId, "driver-1");
        return {
          items: [
            {
              id: "ride-1",
              createdAt,
              status: "MATCHED",
              pickupZone: { id: "zone-1", name: "mirpur-1" },
              destinationZone: { id: "zone-2", name: "mirpur-10" },
            },
          ],
          hasNextPage: false,
        };
      },
    },
    async (key) => cache.get(key) ?? null,
    async (key, value) => {
      cache.set(String(key), String(value));
    },
    async () => {
      const first = responseCollector();
      await listDriverRideRequestsController(driverRequest, first.response as never);
      const second = responseCollector();
      await listDriverRideRequestsController(driverRequest, second.response as never);

      assert.equal(reads, 1);
      assert.deepEqual(second.getBody(), JSON.parse(JSON.stringify(first.getBody())));
    },
  );
});

test("passenger completed history uses offset pagination metadata", async () => {
  await withStubs(
    {
      findCompletedPageByPassenger: async (passengerId, page, limit) => {
        assert.equal(passengerId, "passenger-1");
        assert.equal(page, 2);
        assert.equal(limit, 10);
        return {
          items: [{ id: "ride-1", status: "COMPLETED" }],
          totalItems: 11,
        };
      },
    },
    async () => null,
    async () => undefined,
    async () => {
      const collected = responseCollector();
      await listPassengerCompletedRideRequestsController(
        passengerRequest,
        collected.response as never,
      );
      assert.deepEqual((collected.getBody() as { data: unknown }).data, {
        items: [{ id: "ride-1", status: "COMPLETED" }],
        page: 2,
        limit: 10,
        totalItems: 11,
        totalPages: 2,
        hasNextPage: false,
      });
    },
  );
});

test("completed history endpoints enforce actor roles", async () => {
  await assert.rejects(
    () =>
      listDriverCompletedRideRequestsController(
        passengerRequest,
        responseCollector().response as never,
      ),
    (error: { status: number; code: string }) =>
      error.status === 403 && error.code === "forbidden",
  );

  await assert.rejects(
    () =>
      listPassengerCompletedRideRequestsController(
        driverRequest,
        responseCollector().response as never,
      ),
    (error: { status: number; code: string }) =>
      error.status === 403 && error.code === "forbidden",
  );
});
