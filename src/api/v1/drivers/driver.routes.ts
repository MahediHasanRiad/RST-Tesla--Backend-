import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { asyncHandler } from "../../../shared/http/async-handler.js";
import { closeRidePoolController } from "./controllers/close-ride-pool.controller.js";
import { openRidePoolController } from "./controllers/open-ride-pool.controller.js";
import { listDriverRideRequestsController } from "./controllers/list-driver-ride-requests.controller.js";
import { listDriverCompletedRideRequestsController } from "./controllers/list-driver-completed-ride-requests.controller.js";
import { cancelRideRequestController } from "./controllers/cancel-ride-request.controller.js";
import { acceptRideRequestController } from "./controllers/accept-ride-request.controller.js";

export const driverRoutes = Router();

driverRoutes.post(
  "/open-pool",
  requireAuth,
  asyncHandler(openRidePoolController),
);

driverRoutes.post(
  "/close-pool",
  requireAuth,
  asyncHandler(closeRidePoolController),
);

driverRoutes.get(
  "/list-of-ride-request-by-driver",
  requireAuth,
  asyncHandler(listDriverRideRequestsController),
);

driverRoutes.get(
  "/driver-completed-rides",
  requireAuth,
  asyncHandler(listDriverCompletedRideRequestsController),
);

driverRoutes.post(
  "/:rideRequestId/cancel",
  requireAuth,
  asyncHandler(cancelRideRequestController),
);

driverRoutes.post(
  "/:rideRequestId/accept",
  requireAuth,
  asyncHandler(acceptRideRequestController),
);