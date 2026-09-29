import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { resolveRouteCorridor } from "../../../../shared/ride/route-corridor.js";
import { openRidePoolSchema } from "../validation/ride-pool.validation.js";
import { vehicleRepository } from "../../vehicles/vehicle.repository.js";
import { ridePoolRepository } from "../repository/ride-pool.repository.js";

export async function openRidePoolController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  // input validation
  const input = openRidePoolSchema.parse(request.body);
  if (input.pickupZoneId === input.destinationZoneId) {
    throw new ApiError(400, "same_service_zone");
  }

  // check location
  const [pickupZone, destinationZone] = await ridePoolRepository.findZones(
    input.pickupZoneId,
    input.destinationZoneId,
  );

  if (!pickupZone) throw new ApiError(404, "pickup_zone_not_found");
  if (!destinationZone) throw new ApiError(404, "destination_zone_not_found");
  
  // check the reserved location
  if (!resolveRouteCorridor(pickupZone.name, destinationZone.name)) {
    throw new ApiError(400, "unsupported_route");
  }

  // find driver
  const driver = await vehicleRepository.findDriverByUserId(request.user.id)
  if(!driver) throw new ApiError(404, 'Driver not found')

  // create
  const result = await ridePoolRepository.createForDriver(driver?.id, input);
  if (result.kind === "vehicle_not_found") {
    throw new ApiError(404, "vehicle_not_found");
  }
  
  if (result.kind === "vehicle_offline") {
    throw new ApiError(409, "vehicle_offline");
  }
  
  if (result.kind === "active_pool_exists") {
    throw new ApiError(409, "active_pool_exists");
  }

  return sendSuccess(response, 201, result.pool);
}
