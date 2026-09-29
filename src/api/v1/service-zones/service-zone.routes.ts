import { Router } from "express";
import { asyncHandler } from "../../../shared/http/async-handler.js";
import { listServiceZonesController } from "./controllers/list-service-zones.controller.js";

export const serviceZoneRoutes = Router();

serviceZoneRoutes.get("/", asyncHandler(listServiceZonesController));
