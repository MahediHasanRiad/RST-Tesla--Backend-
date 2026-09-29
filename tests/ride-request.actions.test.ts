import assert from "node:assert/strict";
import test from "node:test";
import { cancelRideRequestController } from "../src/api/v1/ride-requests/controllers/cancel-ride-request.controller.js";
import { getRideRequestController } from "../src/api/v1/ride-requests/controllers/get-ride-request.controller.js";
import { getRideRequestStatusHistoryController } from "../src/api/v1/ride-requests/controllers/get-ride-request-status-history.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/ride-request.repository.js";

const rideRequestId = "550e8400-e29b-41d4-a716-446655440000";
const passenger = {
  id: "passenger-1",
  email: "passenger@example.com",
  role: "PASSENGER" as const,
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

async function withRepositoryStubs(
  stubs: Partial<{
    findByIdForPassenger: (...args: unknown[]) => Promise<unknown>;
    findStatusHistoryForPassenger: (...args: unknown[]) => Promise<unknown>;
    cancelForPassenger: (...args: unknown[]) => Promise<unknown>;
  }>,
  callback: () => Promise<void>,
) {
  const repository = rideRequestRepository as unknown as Record<string, unknown>;
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

function request() {
  return {
    user: passenger,
    params: { rideRequestId },
  } as never;
}

test("get ride request returns the passenger-owned request", async () => {
  const collected = responseCollector();
  await withRepositoryStubs(
    {
      findByIdForPassenger: async (id, passengerId) => ({
        id,
        passengerId,
        status: "REQUESTED",
      }),
    },
    async () => {
      await getRideRequestController(request(), collected.response as never);
    },
  );

  assert.equal((collected.getBody() as { success: boolean }).success, true);
});

test("status history returns only the passenger-owned request history", async () => {
  const collected = responseCollector();
  await withRepositoryStubs(
    {
      findStatusHistoryForPassenger: async () => ({
        id: rideRequestId,
        status: "REQUESTED",
        statusHistory: [],
      }),
    },
    async () => {
      await getRideRequestStatusHistoryController(
        request(),
        collected.response as never,
      );
    },
  );

  assert.equal((collected.getBody() as { success: boolean }).success, true);
});

test("cancel ride request returns the atomic cancellation result", async () => {
  const collected = responseCollector();
  await withRepositoryStubs(
    {
      cancelForPassenger: async () => ({
        kind: "cancelled",
        request: { id: rideRequestId, status: "CANCELLED" },
      }),
    },
    async () => {
      await cancelRideRequestController(request(), collected.response as never);
    },
  );

  assert.deepEqual(
    (collected.getBody() as { data: unknown }).data,
    { id: rideRequestId, status: "CANCELLED" },
  );
});

test("cancel rejects a request after its cancellation window", async () => {
  await withRepositoryStubs(
    {
      cancelForPassenger: async () => ({
        kind: "invalid_status",
        status: "STARTED",
      }),
    },
    async () => {
      await assert.rejects(
        () =>
          cancelRideRequestController(
            request(),
            responseCollector().response as never,
          ),
        (error: { status: number; code: string }) =>
          error.status === 409 &&
          error.code === "ride_request_cannot_be_cancelled",
      );
    },
  );
});
