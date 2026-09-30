import assert from "node:assert/strict";
import test from "node:test";
import { listAvailableVehiclesController } from "../src/api/v1/ride-requests/controllers/list-available-vehicles.controller.js";
import { rideRequestRepository } from "../src/api/v1/ride-requests/repository/ride-request.repository.js";
import { redis } from "../src/lib/redis.js";

const pickupZone = { id: "550e8400-e29b-41d4-a716-446655440000", name: "mirpur-1", latitude: "23.793700", longitude: "90.365400" };
const destinationZone = { id: "550e8400-e29b-41d4-a716-446655440001", name: "mirpur-10", latitude: "23.806900", longitude: "90.368700" };

test("available vehicle discovery returns the selected vehicle and seats", async () => {
  const repository = rideRequestRepository as unknown as Record<string, unknown>;
  const cache = redis as unknown as Record<string, unknown>;
  const originals = {
    findZones: repository.findZones,
    findAvailableVehiclesByRoute: repository.findAvailableVehiclesByRoute,
    get: cache.get,
    set: cache.set,
  };
  repository.findZones = async () => [pickupZone, destinationZone];
  repository.findAvailableVehiclesByRoute = async () => [{
    id: "vehicle-1",
    name: "Bullet",
    capacity: 3,
    availability: "ONLINE",
    createdAt: new Date("2026-09-29T00:00:00.000Z"),
    updatedAt: new Date("2026-09-29T00:00:00.000Z"),
  }];
  cache.get = async () => null;
  cache.set = async () => undefined;
  try {
    let body: any;
    const response = {
      req: { requestId: "test-request" },
      status() { return { json(value: unknown) { body = value; return value; } }; },
    };
    await listAvailableVehiclesController({
      user: { id: "passenger-1", role: "PASSENGER" },
      query: { pickupZoneId: pickupZone.id, destinationZoneId: destinationZone.id, seats: "2" },
    } as never, response as never);
    const item = body.data.items[0];
    assert.equal(item.vehicleId, "vehicle-1");
    assert.equal(item.poolId, null);
    assert.equal(item.reservedSeats, 0);
    assert.equal(item.availableSeats, 3);
  } finally {
    repository.findZones = originals.findZones;
    repository.findAvailableVehiclesByRoute = originals.findAvailableVehiclesByRoute;
    cache.get = originals.get;
    cache.set = originals.set;
  }
});
