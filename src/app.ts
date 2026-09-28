import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRoutes } from "./api/v1/auth/auth.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

export function buildApp() {

  const app = express();
  
  app.use(cors({ origin: false }));
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({extended: true}))

  app.use("/api/v1/auth", authRoutes);
  app.get("/health", (_request, response) => response.json({ status: "ok" }));

  app.use(errorHandler);

  return app;
}
