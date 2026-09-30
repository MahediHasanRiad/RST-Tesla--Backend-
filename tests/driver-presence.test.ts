import assert from "node:assert/strict";
import test from "node:test";
import { AuthCredentials } from "../src/shared/auth/credentials.js";
import { authRepository } from "../src/api/v1/auth/auth.repository.js";
import { vehicleRepository } from "../src/api/v1/vehicles/vehicle.repository.js";
import { createDriverPresence } from "../src/realtime/driver-presence.js";

type Listener = (...args: unknown[]) => void;

function fakeSocket(id: string, driverId = "driver-1") {
  const listeners = new Map<string, Listener>();
  const socket = {
    id,
    data: { driverId },
    handshake: { auth: { accessToken: "test-token" } },
    emitted: [] as Array<{ event: string; payload: unknown }>,
    disconnected: false,
    on(event: string, listener: Listener) {
      listeners.set(event, listener);
      return socket;
    },
    emit(event: string, payload: unknown) {
      socket.emitted.push({ event, payload });
      return socket;
    },
    disconnect() {
      socket.disconnected = true;
      listeners.get("disconnect")?.();
    },
    trigger(event: string, ...args: unknown[]) {
      listeners.get(event)?.(...args);
    },
  };
  return socket;
}

async function withAvailabilityStub(
  implementation: (driverId: string, availability: "ONLINE" | "OFFLINE") => Promise<unknown>,
  callback: () => Promise<void>,
) {
  const repository = vehicleRepository as unknown as Record<string, unknown>;
  const original = repository.setAvailabilityForDriver;
  repository.setAvailabilityForDriver = implementation;
  try {
    await callback();
  } finally {
    repository.setAvailabilityForDriver = original;
  }
}

test("presence authentication accepts only a driver with an owned vehicle", async () => {
  const credentials = AuthCredentials as unknown as Record<string, unknown>;
  const auth = authRepository as unknown as Record<string, unknown>;
  const vehicles = vehicleRepository as unknown as Record<string, unknown>;
  const originalVerify = credentials.verifyAccessToken;
  const originalFindUser = auth.findUserById;
  const originalFindDriver = vehicles.findDriverByUserId;
  const originalFindVehicle = vehicles.findByDriverId;

  credentials.verifyAccessToken = async () => ({ userId: "driver-user", role: "DRIVER" });
  auth.findUserById = async () => ({ id: "driver-user", role: "DRIVER" });
  vehicles.findDriverByUserId = async () => ({ id: "driver-1" });
  vehicles.findByDriverId = async () => ({ id: "vehicle-1" });

  try {
    const presence = createDriverPresence();
    const socket = fakeSocket("socket-1");
    let authenticationError: Error | undefined;
    await presence.authenticate(socket as never, (error) => {
      authenticationError = error;
    });
    assert.equal(authenticationError, undefined);
    assert.equal(socket.data.driverId, "driver-1");
  } finally {
    credentials.verifyAccessToken = originalVerify;
    auth.findUserById = originalFindUser;
    vehicles.findDriverByUserId = originalFindDriver;
    vehicles.findByDriverId = originalFindVehicle;
  }
});

test("passenger presence authentication is rejected", async () => {
  const credentials = AuthCredentials as unknown as Record<string, unknown>;
  const auth = authRepository as unknown as Record<string, unknown>;
  const originalVerify = credentials.verifyAccessToken;
  const originalFindUser = auth.findUserById;
  credentials.verifyAccessToken = async () => ({ userId: "passenger-user", role: "PASSENGER" });
  auth.findUserById = async () => ({ id: "passenger-user", role: "PASSENGER" });

  try {
    const presence = createDriverPresence();
    let authenticationError: Error | undefined;
    await presence.authenticate(fakeSocket("socket-1") as never, (error) => {
      authenticationError = error;
    });
    assert.equal(authenticationError?.message, "forbidden");
  } finally {
    credentials.verifyAccessToken = originalVerify;
    auth.findUserById = originalFindUser;
  }
});

test("presence keeps a vehicle online until the final socket disconnects", async () => {
  const transitions: string[] = [];
  await withAvailabilityStub(
    async (_driverId, availability) => {
      transitions.push(availability);
      return { kind: "updated", vehicle: { availability } };
    },
    async () => {
      const presence = createDriverPresence();
      const first = fakeSocket("socket-1");
      const second = fakeSocket("socket-2");

      await presence.handleConnection(first as never);
      await presence.handleConnection(second as never);
      first.trigger("disconnect");
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(transitions, ["ONLINE", "ONLINE"]);

      second.trigger("disconnect");
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(transitions, ["ONLINE", "ONLINE", "OFFLINE"]);
    },
  );
});

test("explicit logout marks the vehicle offline and disconnects the presence sockets", async () => {
  const transitions: string[] = [];
  await withAvailabilityStub(
    async (_driverId, availability) => {
      transitions.push(availability);
      return { kind: "updated", vehicle: { availability } };
    },
    async () => {
      const presence = createDriverPresence();
      const socket = fakeSocket("socket-1");
      await presence.handleConnection(socket as never);

      let acknowledgement: unknown;
      socket.trigger("driver:logout", (result: unknown) => {
        acknowledgement = result;
      });
      await new Promise((resolve) => setImmediate(resolve));

      assert.deepEqual(transitions, ["ONLINE", "OFFLINE"]);
      assert.deepEqual(acknowledgement, { ok: true, availability: "OFFLINE" });
      assert.equal(socket.disconnected, true);
    },
  );
});

test("online transition failure disconnects the socket without changing other drivers", async () => {
  await withAvailabilityStub(
    async () => {
      throw new Error("database unavailable");
    },
    async () => {
      const presence = createDriverPresence();
      const socket = fakeSocket("socket-1");
      await presence.handleConnection(socket as never);
      assert.equal(socket.disconnected, true);
      assert.equal(presence.socketsByDriver.size, 0);
    },
  );
});
