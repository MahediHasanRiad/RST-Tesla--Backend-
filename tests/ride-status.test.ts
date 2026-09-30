import assert from "node:assert/strict";
import test from "node:test";
import {
  attachRideStatus,
  emitRideStatusUpdate,
} from "../src/realtime/ride-status.js";

function fakeSocket(userId: string, role: string) {
  const emitted: unknown[] = [];
  return {
    data: { userId, role },
    emitted,
    emit(_event: string, payload: unknown) {
      emitted.push(payload);
      return this;
    },
  };
}

test("ride status updates are emitted only to the affected passenger sockets", () => {
  const passengerSocket = fakeSocket("passenger-1", "PASSENGER");
  const secondPassengerSocket = fakeSocket("passenger-2", "PASSENGER");
  const driverSocket = fakeSocket("driver-1", "DRIVER");
  const sockets = new Map([
    ["passenger-1", passengerSocket],
    ["passenger-2", secondPassengerSocket],
    ["driver-1", driverSocket],
  ]);

  attachRideStatus({ sockets: { sockets } } as never);

  const delivered = emitRideStatusUpdate("passenger-1", {
    rideRequestId: "ride-1",
    status: "MATCHED",
  });

  assert.equal(delivered, 1);
  assert.deepEqual(passengerSocket.emitted, [
    { rideRequestId: "ride-1", status: "MATCHED" },
  ]);
  assert.deepEqual(secondPassengerSocket.emitted, []);
  assert.deepEqual(driverSocket.emitted, []);
});

test("ride status updates support driver rejection", () => {
  const passengerSocket = fakeSocket("passenger-1", "PASSENGER");
  const sockets = new Map([["passenger-1", passengerSocket]]);
  attachRideStatus({ sockets: { sockets } } as never);

  emitRideStatusUpdate("passenger-1", {
    rideRequestId: "ride-2",
    status: "CANCELLED",
  });

  assert.deepEqual(passengerSocket.emitted, [
    { rideRequestId: "ride-2", status: "CANCELLED" },
  ]);
});
