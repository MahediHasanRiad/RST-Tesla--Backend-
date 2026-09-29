import assert from "node:assert/strict";
import test from "node:test";
import { listServiceZonesController } from "../src/api/v1/service-zones/controllers/list-service-zones.controller.js";
import { serviceZoneRepository } from "../src/api/v1/service-zones/service-zone.repository.js";
import { redis } from "../src/lib/redis.js";

type RedisStub = {
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
};

const redisStub = redis as unknown as RedisStub;
const repositoryStub = serviceZoneRepository as unknown as {
  findPage: (...args: unknown[]) => Promise<unknown>;
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
  findPage: (...args: unknown[]) => Promise<unknown>,
  callback: () => Promise<void>,
) {
  const originalGet = redisStub.get;
  const originalSet = redisStub.set;
  const originalFindPage = repositoryStub.findPage;
  redisStub.get = get;
  redisStub.set = set;
  repositoryStub.findPage = findPage;
  try {
    await callback();
  } finally {
    redisStub.get = originalGet;
    redisStub.set = originalSet;
    repositoryStub.findPage = originalFindPage;
  }
}

test("ServiceZone list caches a cursor window and reuses the cache hit", async () => {
  const cache = new Map<string, string>();
  let databaseReads = 0;
  const findPage = async () => {
    databaseReads += 1;
    return {
      items: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "mirpur-1",
          latitude: "23.793700",
          longitude: "90.365400",
          createdAt: new Date("2026-09-29T00:00:00.000Z"),
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
    findPage,
    async () => {
      const first = responseCollector();
      await listServiceZonesController(
        { query: {}, } as never,
        first.response as never,
      );
      const second = responseCollector();
      await listServiceZonesController(
        { query: {}, } as never,
        second.response as never,
      );

      assert.equal(databaseReads, 1);
      assert.deepEqual(first.getBody(), second.getBody());
    },
  );
});

test("ServiceZone list falls back to PostgreSQL when Redis is unavailable", async () => {
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
      await listServiceZonesController(
        { query: {}, } as never,
        collected.response as never,
      );
      assert.equal(databaseReads, 1);
      assert.equal((collected.getBody() as { success: boolean }).success, true);
    },
  );
});
