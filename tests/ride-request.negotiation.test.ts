import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import { acceptRideRequestController } from "../src/api/v1/ride-requests/controllers/accept-ride-request.controller.js";
import { counterFareRideRequestController } from "../src/api/v1/ride-requests/controllers/counter-fare-ride-request.controller.js";
import { redis } from "../src/lib/redis.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/repository/ride-request.repository.js";
import { attachRideStatus } from "../src/realtime/ride-status.js";

const rideRequestId = "550e8400-e29b-41d4-a716-446655440000";

type RedisStub = {
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

const redisStub = redis as unknown as RedisStub;
const repositoryStub = rideRequestRepository as unknown as Record<string, unknown>;

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

async function withStubs(
  redisMethods: Partial<RedisStub>,
  repositoryMethods: Record<string, unknown>,
  callback: () => Promise<void>,
) {
  const originalRedis = new Map<string, unknown>();
  for (const [name, implementation] of Object.entries(redisMethods)) {
    originalRedis.set(name, redisStub[name as keyof RedisStub]);
    redisStub[name as keyof RedisStub] = implementation as never;
  }

  const originalRepository = new Map<string, unknown>();
  for (const [name, implementation] of Object.entries(repositoryMethods)) {
    originalRepository.set(name, repositoryStub[name]);
    repositoryStub[name] = implementation;
  }

  try {
    await callback();
  } finally {
    for (const [name, implementation] of originalRedis) {
      redisStub[name as keyof RedisStub] = implementation as never;
    }
    for (const [name, implementation] of originalRepository) {
      repositoryStub[name] = implementation;
    }
  }
}

const passenger = { id: "passenger-1", role: "PASSENGER" as const };
const driver = { id: "driver-1", role: "DRIVER" as const };

function negotiationContext(overrides: Record<string, unknown> = {}) {
  return {
    id: rideRequestId,
    status: "PENDING_DRIVER_ACCEPTANCE",
    passengerId: passenger.id,
    pool: { vehicle: { driver: { userId: driver.id } } },
    ...overrides,
  };
}

test("passenger and driver counter fares are stored in Redis without changing status", async () => {
  const writes: unknown[][] = [];
  const context = negotiationContext();

  await withStubs(
    {
      set: async (...args) => {
        writes.push(args);
      },
    },
    { findFareNegotiationContext: async () => context },
    async () => {
      const passengerResponse = responseCollector();
      await counterFareRideRequestController(
        {
          user: passenger,
          params: { rideRequestId },
          body: { farePaisa: 12000 },
        } as never,
        passengerResponse.response as never,
      );

      const driverResponse = responseCollector();
      await counterFareRideRequestController(
        {
          user: driver,
          params: { rideRequestId },
          body: { farePaisa: 13000 },
        } as never,
        driverResponse.response as never,
      );

      assert.deepEqual(writes[0]?.slice(1), ["12000", "EX", 86400]);
      assert.deepEqual(writes[1]?.slice(1), ["13000", "EX", 86400]);
      assert.equal(
        (passengerResponse.getBody() as { data: { status: string } }).data.status,
        "PENDING_DRIVER_ACCEPTANCE",
      );
      assert.equal(driverResponse.getStatus(), 200);
    },
  );
});

test("driver acceptance persists the cached counter fare and cleans it up", async () => {
  let acceptedFare: number | undefined;
  let deletedKey: string | undefined;
  const acceptedRequest = {
    id: rideRequestId,
    passengerId: passenger.id,
    status: "MATCHED",
    farePaisa: 13000,
  };

  await withStubs(
    {
      get: async () => "13000",
      del: async (key) => {
        deletedKey = key;
      },
    },
    {
      acceptForDriver: async (
        requestId: string,
        driverUserId: string,
        counterFarePaisa?: number,
      ) => {
        assert.equal(requestId, rideRequestId);
        assert.equal(driverUserId, driver.id);
        acceptedFare = counterFarePaisa;
        return {
          kind: "accepted",
          pool: { id: "pool-1", reservedSeats: 2 },
          request: acceptedRequest,
        };
      },
    },
    async () => {
      const emitted: unknown[] = [];
      attachRideStatus({
        sockets: {
          sockets: new Map([
            ["passenger", {
              data: { userId: passenger.id, role: "PASSENGER" },
              emit: (_event: string, payload: unknown) => {
                emitted.push(payload);
              },
            }],
          ]),
        },
      } as never);
      const collected = responseCollector();
      await acceptRideRequestController(
        {
          user: driver,
          params: { rideRequestId },
        } as never,
        collected.response as never,
      );

      assert.equal(acceptedFare, 13000);
      assert.equal(deletedKey, `ride-request:counter-fare:${rideRequestId}`);
      assert.equal(collected.getStatus(), 200);
      assert.deepEqual(emitted, [
        { rideRequestId, status: "MATCHED" },
      ]);
      assert.equal(
        (collected.getBody() as { data: { pool: { reservedSeats: number } } })
          .data.pool.reservedSeats,
        2,
      );
    },
  );
});

test("driver acceptance maps a full pool to a conflict", async () => {
  await withStubs(
    { get: async () => null },
    {
      acceptForDriver: async () => ({ kind: "capacity_conflict" }),
    },
    async () => {
      await assert.rejects(
        () =>
          acceptRideRequestController(
            {
              user: driver,
              params: { rideRequestId },
            } as never,
            responseCollector().response as never,
          ),
        (error: { status: number; code: string }) =>
          error.status === 409 && error.code === "ride_pool_capacity_conflict",
      );
    },
  );
});

test("counter fare rejects an unrelated user and invalid fare input", async () => {
  await withStubs(
    { set: async () => undefined },
    { findFareNegotiationContext: async () => negotiationContext() },
    async () => {
      await assert.rejects(
        () =>
          counterFareRideRequestController(
            {
              user: { id: "other-user", role: "PASSENGER" },
              params: { rideRequestId },
              body: { farePaisa: 12000 },
            } as never,
            responseCollector().response as never,
          ),
        (error: { status: number; code: string }) =>
          error.status === 403 && error.code === "forbidden",
      );

      await assert.rejects(
        () =>
          counterFareRideRequestController(
            {
              user: passenger,
              params: { rideRequestId },
              body: { farePaisa: 0 },
            } as never,
            responseCollector().response as never,
          ),
        (error) => error instanceof ZodError,
      );
    },
  );
});
