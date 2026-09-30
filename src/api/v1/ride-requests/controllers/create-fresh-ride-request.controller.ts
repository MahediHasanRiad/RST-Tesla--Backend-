import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { calculateDistanceKm } from "../../../../shared/ride/distance.js";
import { calculateFare } from "../../../../shared/ride/fare.js";
import { resolveRouteCorridor } from "../../../../shared/ride/route-corridor.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";
import { freshRideRequestSchema } from "../validation/ride-request.validation.js";
import { vehicleRepository } from "../../vehicles/vehicle.repository.js";
import { persistAndQueuePushNotification } from "../../../../shared/notifications/push-notification.js";

export async function createFreshRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") {
    throw new ApiError(403, "forbidden");
  }

  // input validation
  const input = freshRideRequestSchema.parse(request.body);
  if (input.pickupZoneId === input.destinationZoneId) {
    throw new ApiError(400, "same_service_zone");
  }

  // check location
  const [pickupZone, destinationZone] = await rideRequestRepository.findZones(
    input.pickupZoneId,
    input.destinationZoneId,
  );
  if (!pickupZone) throw new ApiError(404, "pickup_zone_not_found");
  if (!destinationZone) throw new ApiError(404, "destination_zone_not_found");

  const route = resolveRouteCorridor(pickupZone.name, destinationZone.name);
  if (!route) throw new ApiError(400, "unsupported_route");

  const distanceKm = calculateDistanceKm(
    pickupZone.latitude,
    pickupZone.longitude,
    destinationZone.latitude,
    destinationZone.longitude,
  );
  const fare = calculateFare(distanceKm, input.weatherCondition);

  // create
  const result = await rideRequestRepository.createFresh(
    request.user.id,
    input,
    fare.estimatedFare,
  );
  if (result.kind === "vehicle_not_found") {
    throw new ApiError(404, "vehicle_not_found");
  }
  if (result.kind === "capacity_conflict") {
    throw new ApiError(409, "vehicle_capacity_conflict");
  }
  if (result.kind === "pool_not_found") {
    throw new ApiError(404, "open_ride_pool_not_found");
  }
  if (result.kind === "pool_conflict") {
    throw new ApiError(409, "vehicle_has_active_ride_pool");
  }

  const vehicle = await vehicleRepository.findById(input.vehicleId);
  await persistAndQueuePushNotification({
    userId: vehicle?.driver.userId,
    eventType: "RIDE_REQUEST_CREATED",
    title: "New ride request",
    body: "A passenger created a ride request for your vehicle.",
    data: { rideRequestId: result.request.id },
  });

  return sendSuccess(response, 201, {
    id: result.request.id,
    pickupZone: result.request.pickupZone,
    destinationZone: result.request.destinationZone,
    route: route.names,
    seats: result.request.requestedSeats,
    enableRidePool: result.request.enableRidePool,
    status: result.request.status,
    pool: result.pool,
    fare,
    createdAt: result.request.createdAt,
  });
}
