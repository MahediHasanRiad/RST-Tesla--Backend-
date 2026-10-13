import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { asyncHandler } from "../../../shared/http/async-handler.js";
import { createServiceZoneController } from "./controllers/create-service-zone.controller.js";
import { listServiceZonesController } from "./controllers/list-service-zones.controller.js";

export const serviceZoneRoutes = Router();

serviceZoneRoutes.post(
  "/add-service-zone",
  requireAuth,
  asyncHandler(createServiceZoneController),
);

serviceZoneRoutes.get("/list-of-service-zone", asyncHandler(listServiceZonesController));
