import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import { acceptRideRequestController } from "../src/api/v1/ride-requests/controllers/accept-ride-request.controller.js";
import { counterFareRideRequestController } from "../src/api/v1/ride-requests/controllers/counter-fare-ride-request.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/repository/ride-request.repository.js";

const rideRequestId = "550e8400-e29b-41d4-a716-446655440000";
const passenger = { id: "passenger-1", role: "PASSENGER" as const };
const driver = { id: "driver-1", role: "DRIVER" as const };
const repositoryStub = rideRequestRepository as unknown as Record<string, unknown>;

function responseCollector() {
  let body: unknown;
  let statusCode: number | undefined;
  const response = {
    req: { requestId: "test-request" },
    status(status: number) {
      statusCode = status;
      return { json(value: unknown) { body = value; return value; } };
    },
  };
  return { response, getBody: () => body, getStatus: () => statusCode };
}

async function withRepositoryStubs(methods: Record<string, unknown>, callback: () => Promise<void>) {
  const originals = new Map<string, unknown>();
  for (const [name, implementation] of Object.entries(methods)) {
    originals.set(name, repositoryStub[name]);
    repositoryStub[name] = implementation;
  }
  try { await callback(); } finally {
    for (const [name, implementation] of originals) repositoryStub[name] = implementation;
  }
}

function negotiationContext() {
  return {
    id: rideRequestId,
    status: "PENDING_DRIVER_ACCEPTANCE",
    passengerId: passenger.id,
    ridePool: { vehicle: { driver: { userId: driver.id } } },
    fareOffers: [{
      id: "offer-old",
      offerVersion: 1,
      amountPaisa: 10000,
      proposedById: passenger.id,
      passengerAcceptedAt: null,
      driverAcceptedAt: null,
    }],
  };
}

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-2",
    offerVersion: 2,
    amountPaisa: 13000,
    proposedById: driver.id,
    passengerAcceptedAt: null,
    driverAcceptedAt: null,
    ...overrides,
  };
}

test("passenger and driver counter offers persist a new authoritative offer", async () => {
  const counters: Array<{ actorId: string; amountPaisa: number }> = [];
  await withRepositoryStubs({
    findFareNegotiationContext: async () => negotiationContext(),
    counterFare: async (requestId: string, actorId: string, amountPaisa: number) => {
      assert.equal(requestId, rideRequestId);
      counters.push({ actorId, amountPaisa });
      return {
        kind: "countered", requestId, status: "PENDING_DRIVER_ACCEPTANCE",
        offer: offer({ amountPaisa }), passengerId: passenger.id, driverUserId: driver.id,
      };
    },
  }, async () => {
    await counterFareRideRequestController(
      { user: passenger, params: { rideRequestId }, body: { farePaisa: 12000 } } as never,
      responseCollector().response as never,
    );
    await counterFareRideRequestController(
      { user: driver, params: { rideRequestId }, body: { farePaisa: 13000 } } as never,
      responseCollector().response as never,
    );
    assert.deepEqual(counters, [
      { actorId: passenger.id, amountPaisa: 12000 },
      { actorId: driver.id, amountPaisa: 13000 },
    ]);
  });
});

test("one-sided acceptance stays pending and mutual acceptance matches", async () => {
  const accepted: string[] = [];
  const currentOffer = offer();
  await withRepositoryStubs({
    findFareNegotiationContext: async () => negotiationContext(),
    acceptForDriver: async () => {
      accepted.push("driver");
      return {
        kind: "accepted", matched: false,
        request: { id: rideRequestId, status: "PENDING_DRIVER_ACCEPTANCE" },
        offer: { ...currentOffer, driverAcceptedAt: new Date() },
        passengerId: passenger.id, driverUserId: driver.id, pool: null,
      };
    },
    acceptForPassenger: async () => {
      accepted.push("passenger");
      return {
        kind: "accepted", matched: true,
        request: { id: rideRequestId, status: "MATCHED", farePaisa: 13000 },
        offer: { ...currentOffer, driverAcceptedAt: new Date(), passengerAcceptedAt: new Date() },
        passengerId: passenger.id, driverUserId: driver.id,
        pool: { id: "pool-1", reservedSeats: 1 },
      };
    },
  }, async () => {
    const first = responseCollector();
    await acceptRideRequestController(
      { user: driver, params: { rideRequestId }, body: { offerVersion: 2 } } as never,
      first.response as never,
    );
    assert.equal(first.getStatus(), 200);
    assert.equal((first.getBody() as { data: { matched: boolean } }).data.matched, false);

    const second = responseCollector();
    await acceptRideRequestController(
      { user: passenger, params: { rideRequestId }, body: { offerVersion: 2 } } as never,
      second.response as never,
    );
    assert.equal(second.getStatus(), 200);
    assert.equal((second.getBody() as { data: { matched: boolean } }).data.matched, true);
    assert.deepEqual(accepted, ["driver", "passenger"]);
  });
});

test("stale acceptance and capacity conflicts map to standard conflicts", async () => {
  await withRepositoryStubs({ acceptForDriver: async () => ({ kind: "stale_offer", offer: offer() }) }, async () => {
    await assert.rejects(
      () => acceptRideRequestController(
        { user: driver, params: { rideRequestId }, body: { offerVersion: 1 } } as never,
        responseCollector().response as never,
      ),
      (error: { status: number; code: string }) => error.status === 409 && error.code === "ride_offer_stale",
    );
  });

  await withRepositoryStubs({ acceptForDriver: async () => ({ kind: "capacity_conflict" }) }, async () => {
    await assert.rejects(
      () => acceptRideRequestController(
        { user: driver, params: { rideRequestId }, body: { offerVersion: 2 } } as never,
        responseCollector().response as never,
      ),
      (error: { status: number; code: string }) => error.status === 409 && error.code === "ride_pool_capacity_conflict",
    );
  });
});

test("counter fare rejects unrelated users and invalid fare input", async () => {
  await withRepositoryStubs({ findFareNegotiationContext: async () => negotiationContext() }, async () => {
    await assert.rejects(
      () => counterFareRideRequestController(
        { user: { id: "other-user", role: "PASSENGER" }, params: { rideRequestId }, body: { farePaisa: 12000 } } as never,
        responseCollector().response as never,
      ),
      (error: { status: number; code: string }) => error.status === 403 && error.code === "forbidden",
    );
    await assert.rejects(
      () => counterFareRideRequestController(
        { user: passenger, params: { rideRequestId }, body: { farePaisa: 0 } } as never,
        responseCollector().response as never,
      ),
      (error) => error instanceof ZodError,
    );
  });
});
