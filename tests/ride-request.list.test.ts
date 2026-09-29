import assert from "node:assert/strict";
import test from "node:test";
import { listRideRequestsController } from "../src/api/v1/ride-requests/controllers/list-ride-requests.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/ride-request.repository.js";
import { redis } from "../src/lib/redis.js";

type RedisStub = {
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
};

const redisStub = redis as unknown as RedisStub;
const repositoryStub = rideRequestRepository as unknown as {
  findPageByPassenger: (...args: unknown[]) => Promise<unknown>;
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
  findPageByPassenger: (...args: unknown[]) => Promise<unknown>,
  callback: () => Promise<void>,
) {
  const originalGet = redisStub.get;
  const originalSet = redisStub.set;
  const originalFindPageByPassenger = repositoryStub.findPageByPassenger;
  redisStub.get = get;
  redisStub.set = set;
  repositoryStub.findPageByPassenger = findPageByPassenger;
  try {
    await callback();
  } finally {
    redisStub.get = originalGet;
    redisStub.set = originalSet;
    repositoryStub.findPageByPassenger = originalFindPageByPassenger;
  }
}

const passenger = {
  id: "passenger-1",
  email: "passenger@example.com",
  role: "PASSENGER" as const,
};

function request() {
  return { user: passenger, query: {} } as never;
}

test("ride request list loads from PostgreSQL and reuses the Redis cache", async () => {
  const cache = new Map<string, string>();
  let databaseReads = 0;
  const findPageByPassenger = async () => {
    databaseReads += 1;
    return {
      items: [
        {
          id: "ride-1",
          poolId: null,
          requestedSeats: 1,
          status: "REQUESTED",
          farePaisa: 6500,
          createdAt: new Date("2026-09-29T00:00:00.000Z"),
          updatedAt: new Date("2026-09-29T00:00:00.000Z"),
          pickupZone: { id: "zone-1", name: "mirpur-1" },
          destinationZone: { id: "zone-2", name: "mirpur-10" },
        },
      ],
      hasNextPage: false,
    };
  };

  await withStubs(
    async (key) => cache.get(key) ?? null,
    async (key, value) => {
      cache.set(String(key), String(value));
    },
    findPageByPassenger,
    async () => {
      const first = responseCollector();
      await listRideRequestsController(request(), first.response as never);
      const second = responseCollector();
      await listRideRequestsController(request(), second.response as never);

      assert.equal(databaseReads, 1);
      assert.deepEqual(
        second.getBody(),
        JSON.parse(JSON.stringify(first.getBody())),
      );
    },
  );
});

test("ride request list falls back to PostgreSQL when Redis is unavailable", async () => {
  let databaseReads = 0;
  await withStubs(
    async () => {
      throw new Error("redis unavailable");
    },
    async () => {
      throw new Error("redis unavailable");
    },
    async () => {
      databaseReads += 1;
      return { items: [], hasNextPage: false };
    },
    async () => {
      const collected = responseCollector();
      await listRideRequestsController(request(), collected.response as never);
      assert.equal(databaseReads, 1);
      assert.equal((collected.getBody() as { success: boolean }).success, true);
    },
  );
});

test("ride request list rejects driver access", async () => {
  await assert.rejects(
    () =>
      listRideRequestsController(
        {
          user: { ...passenger, role: "DRIVER" },
          query: {},
        } as never,
        responseCollector().response as never,
      ),
    (error: { status: number; code: string }) =>
      error.status === 403 && error.code === "forbidden",
  );
});
