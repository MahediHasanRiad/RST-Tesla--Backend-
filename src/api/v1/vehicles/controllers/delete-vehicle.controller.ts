import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { vehicleRepository } from "../vehicle.repository.js";
export async function deleteVehicleController(
  request: Request,
  response: Response,
) {
  
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  const driver = await vehicleRepository.findDriverByUserId(request.user.id);
  if (!driver) throw new ApiError(404, "driver_not_found");

  // verification
  if (request.user.id !== driver?.userId)
    throw new ApiError(
      403,
      "Does not have permission to update this Behicle !!!",
    );

  const result = await vehicleRepository.delete(driver.id);

  if (result === "missing") throw new ApiError(404, "vehicle_not_found");
  if (result === "has_pools") throw new ApiError(409, "vehicle_has_pools");

  return response.status(204).send();
}
