import { Router } from "express";

import { asyncHandler } from "../../../shared/http/async-handler.js";
import { createVehicleController } from "./controllers/create-vehicle.controller.js";
import { deleteVehicleController } from "./controllers/delete-vehicle.controller.js";
import { findMyVehicleController } from "./controllers/find-my-vehicle.controller.js";
import { findVehicleController } from "./controllers/find-vehicle.controller.js";
import { updateVehicleController } from "./controllers/update-vehicle.controller.js";
import { requireAuth } from "../../../middleware/auth.middleware.js";
import { vehicleUpload } from "../../../middleware/multer.middleware.js";

export const vehicleRoutes = Router();

vehicleRoutes.get("/find-a-vehicle/:vehicleId", asyncHandler(findVehicleController));
vehicleRoutes.get(
  "/my-vehicle",
  requireAuth,
  asyncHandler(findMyVehicleController),
);

vehicleRoutes.post("/add", requireAuth, vehicleUpload.array("images", 5), asyncHandler(createVehicleController));
vehicleRoutes.patch(
  "/update",
  requireAuth,
  vehicleUpload.array("images", 5),
  asyncHandler(updateVehicleController),
);
vehicleRoutes.delete(
  "/delete",
  requireAuth,
  asyncHandler(deleteVehicleController),
);
