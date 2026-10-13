import assert from "node:assert/strict";
import test from "node:test";
import { createServiceZoneController } from "../src/api/v1/service-zones/controllers/create-service-zone.controller.js";
import { serviceZoneRepository } from "../src/api/v1/service-zones/service-zone.repository.js";
import { redis } from "../src/lib/redis.js";
import { createServiceZoneSchema } from "../src/api/v1/service-zones/service-zone.validation.js";

const repositoryStub = serviceZoneRepository as unknown as {
  create: (input: unknown) => Promise<unknown>;
};
const redisStub = redis as unknown as {
  scan: (...args: unknown[]) => Promise<[string, string[]]>;
  del: (...keys: string[]) => Promise<unknown>;
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

test("ServiceZone create validates coordinates and rejects unknown fields", () => {
  assert.deepEqual(
    createServiceZoneSchema.parse({
      name: "Banani",
      latitude: "23.7937",
      longitude: 90.4067,
    }),
    { name: "Banani", latitude: 23.7937, longitude: 90.4067 },
  );

  assert.throws(() =>
    createServiceZoneSchema.parse({
      name: "Banani",
      latitude: 91,
      longitude: 90.4067,
      extra: true,
    }),
  );
});

test("ServiceZone create allows only drivers", async () => {
  const collected = responseCollector();

  await assert.rejects(
    createServiceZoneController(
      {
        user: { id: "passenger-id", role: "PASSENGER" },
        body: { name: "Banani", latitude: 23.7937, longitude: 90.4067 },
      } as never,
      collected.response as never,
    ),
    { status: 403, code: "forbidden" },
  );
});

test("ServiceZone create persists the zone and invalidates list cache", async () => {
  const originalCreate = repositoryStub.create;
  const originalScan = redisStub.scan;
  const originalDel = redisStub.del;
  const deletedKeys: string[][] = [];

  repositoryStub.create = async () => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Banani",
    latitude: "23.793700",
    longitude: "90.406700",
    createdAt: new Date("2026-10-13T00:00:00.000Z"),
  });
  redisStub.scan = async () => ["0", ["list:service-zones:cursor=:limit=20"]];
  redisStub.del = async (...keys) => {
    deletedKeys.push(keys);
  };

  try {
    const collected = responseCollector();
    await createServiceZoneController(
      {
        user: { id: "driver-id", role: "DRIVER" },
        body: { name: "Banani", latitude: 23.7937, longitude: 90.4067 },
      } as never,
      collected.response as never,
    );

    assert.equal((collected.getBody() as { success: boolean }).success, true);
    assert.deepEqual(deletedKeys, [["list:service-zones:cursor=:limit=20"]]);
  } finally {
    repositoryStub.create = originalCreate;
    redisStub.scan = originalScan;
    redisStub.del = originalDel;
  }
});
