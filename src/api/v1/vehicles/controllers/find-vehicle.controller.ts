import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { vehicleRepository } from "../vehicle.repository.js";
import { vehicleIdParamsSchema } from "../vehicle.validation.js";

export async function findVehicleController(
  request: Request,
  response: Response,
) {
  const { vehicleId } = vehicleIdParamsSchema.parse(request.params);
  const vehicle = await vehicleRepository.findById(vehicleId);

  if (!vehicle) throw new ApiError(404, "vehicle_not_found");

  return sendSuccess(response, 200, vehicle);
}
