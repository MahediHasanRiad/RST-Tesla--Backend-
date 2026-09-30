import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { driverRoutes } from "../src/api/v1/drivers/driver.routes.js";
import { rideRequestRoutes } from "../src/api/v1/ride-requests/ride-request.routes.js";
import { openRidePoolSchema, closeRidePoolSchema } from "../src/api/v1/ride-requests/validation/ride-pool.validation.js";

function routePaths(router: { stack: Array<{ route?: { path: string } }> }) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route!.path);
}

test("driver pool router exposes only the dedicated open and close actions", () => {
  const driverPaths = routePaths(driverRoutes);
  assert.equal(driverPaths.includes("/open-pool"), true);
  assert.equal(driverPaths.includes("/close-pool"), true);
  assert.equal(routePaths(rideRequestRoutes).includes("/open-pool"), false);
  assert.equal(routePaths(rideRequestRoutes).includes("/close-pool"), false);
});

test("application composition mounts the driver router", () => {
  const app = buildApp() as typeof buildApp extends (...args: never[]) => infer T ? T : never;
  const mountedDriverRouter = (app as unknown as { router: { stack: Array<{ handle: unknown }> } }).router.stack
    .some((layer) => layer.handle === driverRoutes);
  assert.equal(mountedDriverRouter, true);
});

test("driver pool request bodies reject client ownership fields", () => {
  const validIds = {
    pickupZoneId: "550e8400-e29b-41d4-a716-446655440000",
    destinationZoneId: "550e8400-e29b-41d4-a716-446655440001",
  };
  assert.equal(openRidePoolSchema.safeParse({ ...validIds, vehicleId: validIds.pickupZoneId }).success, false);
  assert.equal(openRidePoolSchema.safeParse({ ...validIds, driverId: validIds.pickupZoneId }).success, false);
  assert.equal(closeRidePoolSchema.safeParse({ poolId: validIds.pickupZoneId, vehicleId: validIds.destinationZoneId }).success, false);
});
