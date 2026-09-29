import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { asyncHandler } from "../../../shared/http/async-handler.js";
import { cancelRideRequestController } from "./controllers/cancel-ride-request.controller.js";
import { acceptRideRequestController } from "./controllers/accept-ride-request.controller.js";
import { createRideRequestController } from "./controllers/create-ride-request.controller.js";
import { counterFareRideRequestController } from "./controllers/counter-fare-ride-request.controller.js";
import { getRideRequestController } from "./controllers/get-ride-request.controller.js";
import { joinRidePoolController } from "./controllers/join-ride-pool.controller.js";
import { listDriverCompletedRideRequestsController } from "./controllers/list-driver-completed-ride-requests.controller.js";
import { listDriverRideRequestsController } from "./controllers/list-driver-ride-requests.controller.js";
import { listAvailableRidePoolsController } from "./controllers/list-available-ride-pools.controller.js";
import { listPassengerCompletedRideRequestsController } from "./controllers/list-passenger-completed-ride-requests.controller.js";
import { openRidePoolController } from "./controllers/open-ride-pool.controller.js";

export const rideRequestRoutes = Router();


rideRequestRoutes.post(
  "/open-pool",
  requireAuth,
  asyncHandler(openRidePoolController),
);

rideRequestRoutes.post(
  "/",
  requireAuth,
  asyncHandler(createRideRequestController),
);

rideRequestRoutes.get(
  "/available-ride-pool",
  requireAuth,
  asyncHandler(listAvailableRidePoolsController),
);

rideRequestRoutes.get(
  "/driver-completed-rides",
  requireAuth,
  asyncHandler(listDriverCompletedRideRequestsController),
);

rideRequestRoutes.get(
  "/list-of-ride-request-by-driver",
  requireAuth,
  asyncHandler(listDriverRideRequestsController),
);

rideRequestRoutes.get(
  "/passenger-completed-rides",
  requireAuth,
  asyncHandler(listPassengerCompletedRideRequestsController),
);

rideRequestRoutes.post(
  "/:rideRequestId/cancel",
  requireAuth,
  asyncHandler(cancelRideRequestController),
);

rideRequestRoutes.post(
  "/:rideRequestId/join-pool",
  requireAuth,
  asyncHandler(joinRidePoolController),
);

rideRequestRoutes.post(
  "/:rideRequestId/accept",
  requireAuth,
  asyncHandler(acceptRideRequestController),
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
