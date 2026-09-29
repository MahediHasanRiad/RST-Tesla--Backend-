import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { vehicleRepository } from "../vehicle.repository.js";

export async function findMyVehicleController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  const driver = await vehicleRepository.findDriverByUserId(request.user.id);
  if (!driver) throw new ApiError(404, "driver_not_found");

  const vehicle = await vehicleRepository.findByDriverId(driver.id);
  if (!vehicle) throw new ApiError(404, "vehicle_not_found");

  return sendSuccess(response, 200, vehicle);
}
