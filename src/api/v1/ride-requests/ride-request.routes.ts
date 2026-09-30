import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { asyncHandler } from "../../../shared/http/async-handler.js";
import { createRideRequestController } from "./controllers/create-ride-request.controller.js";
import { createFreshRideRequestController } from "./controllers/create-fresh-ride-request.controller.js";
import { counterFareRideRequestController } from "./controllers/counter-fare-ride-request.controller.js";
import { getRideRequestController } from "./controllers/get-ride-request.controller.js";
import { listAvailableRidePoolsController } from "./controllers/list-available-ride-pools.controller.js";
import { listAvailableVehiclesController } from "./controllers/list-available-vehicles.controller.js";


export const rideRequestRoutes = Router();

rideRequestRoutes.post(
  "/fresh-ride-request",
  requireAuth,
  asyncHandler(createFreshRideRequestController),
);

rideRequestRoutes.post(
  "/pool-ride-request",
  requireAuth,
  asyncHandler(createRideRequestController),
);

rideRequestRoutes.get(
  "/available-ride-pool",
  requireAuth,
  asyncHandler(listAvailableRidePoolsController),
);

rideRequestRoutes.get(
  "/available-vehicles",
  requireAuth,
  asyncHandler(listAvailableVehiclesController),
);


rideRequestRoutes.post(
  "/:rideRequestId/counter-fare",
  requireAuth,
  asyncHandler(counterFareRideRequestController),
);

rideRequestRoutes.get(
  "/:rideRequestId",
  requireAuth,
  asyncHandler(getRideRequestController),
);
