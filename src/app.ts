import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRoutes } from "./api/v1/auth/auth.routes.js";
import { userRoutes } from "./api/v1/users/user.routes.js";
import { vehicleRoutes } from "./api/v1/vehicles/vehicle.routes.js";
import { serviceZoneRoutes } from "./api/v1/service-zones/service-zone.routes.js";
import { rideRequestRoutes } from "./api/v1/ride-requests/ride-request.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

export function buildApp() {

  const app = express();
  
  app.use(cors({ origin: false }));
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({extended: true}))

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/vehicles", vehicleRoutes);
  app.use("/api/v1/service-zones", serviceZoneRoutes);
  app.use("/api/v1/ride-requests", rideRequestRoutes);
  app.get("/health", (_request, response) => response.json({ status: "ok" }));

  app.use(errorHandler);

  return app;
}
