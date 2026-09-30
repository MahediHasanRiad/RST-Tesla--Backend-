import assert from "node:assert/strict";
import test from "node:test";
import { acceptRideRequestController } from "../src/api/v1/drivers/controllers/accept-ride-request.controller.js";
import { cancelRideRequestController } from "../src/api/v1/drivers/controllers/cancel-ride-request.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/repository/ride-request.repository.js";
import { redis } from "../src/lib/redis.js";
import { attachRideStatus } from "../src/realtime/ride-status.js";

const rideRequestId = "550e8400-e29b-41d4-a716-446655440000";
const driver = { id: "driver-1", role: "DRIVER" as const };

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

function socketForPassenger(
  emitImplementation?: (event: string, payload: unknown) => void,
) {
  const emitted: unknown[] = [];
  const socket = {
    data: { userId: "passenger-1", role: "PASSENGER" },
    emit(_event: string, payload: unknown) {
      if (emitImplementation) {
        emitImplementation(_event, payload);
        return;
      }
      emitted.push(payload);
    },
  };
  attachRideStatus({
    sockets: { sockets: new Map([["passenger", socket]]) },
  } as never);
  return emitted;
}

test("driver acceptance emits MATCHED to the passenger", async () => {
  const repository = rideRequestRepository as unknown as Record<string, unknown>;
  const redisClient = redis as unknown as Record<string, unknown>;
  const originalAccept = repository.acceptForDriver;
  const originalGet = redisClient.get;
  const originalDel = redisClient.del;
  const emitted = socketForPassenger();

  repository.acceptForDriver = async () => ({
    kind: "accepted",
    pool: { id: "pool-1", reservedSeats: 1 },
    request: {
      id: rideRequestId,
      passengerId: "passenger-1",
      status: "MATCHED",
    },
  });
  redisClient.get = async () => null;
  redisClient.del = async () => 1;

  try {
    await acceptRideRequestController(
      { user: driver, params: { rideRequestId } } as never,
      responseCollector().response as never,
    );
  } finally {
    repository.acceptForDriver = originalAccept;
    redisClient.get = originalGet;
    redisClient.del = originalDel;
  }

  assert.deepEqual(emitted, [
    { rideRequestId, status: "MATCHED" },
  ]);
});

test("driver rejection through cancel emits CANCELLED to the passenger", async () => {
  const repository = rideRequestRepository as unknown as Record<string, unknown>;
  const originalCancel = repository.cancelForDriver;
  const emitted = socketForPassenger();

  repository.cancelForDriver = async () => ({
    kind: "cancelled",
    request: {
      id: rideRequestId,
      passengerId: "passenger-1",
      status: "CANCELLED",
    },
  });

  try {
    await cancelRideRequestController(
      { user: driver, params: { rideRequestId } } as never,
      responseCollector().response as never,
    );
  } finally {
    repository.cancelForDriver = originalCancel;
  }

  assert.deepEqual(emitted, [
    { rideRequestId, status: "CANCELLED" },
  ]);
});

test("Socket.IO emission failure does not fail the driver decision", async () => {
  const repository = rideRequestRepository as unknown as Record<string, unknown>;
  const originalCancel = repository.cancelForDriver;
  socketForPassenger(() => {
    throw new Error("socket unavailable");
  });
  repository.cancelForDriver = async () => ({
    kind: "cancelled",
    request: {
      id: rideRequestId,
      passengerId: "passenger-1",
      status: "CANCELLED",
    },
  });

  try {
    const collected = responseCollector();
    await cancelRideRequestController(
      { user: driver, params: { rideRequestId } } as never,
      collected.response as never,
    );
    assert.equal((collected.getBody() as { success: boolean }).success, true);
  } finally {
    repository.cancelForDriver = originalCancel;
  }
});
