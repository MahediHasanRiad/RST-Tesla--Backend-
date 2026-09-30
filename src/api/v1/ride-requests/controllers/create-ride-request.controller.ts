import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { calculateFare } from "../../../../shared/ride/fare.js";
import { calculateDistanceKm } from "../../../../shared/ride/distance.js";
import { resolveRouteCorridor } from "../../../../shared/ride/route-corridor.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { createRideRequestSchema } from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";
import { persistAndQueuePushNotification } from "../../../../shared/notifications/push-notification.js";


export async function createRideRequestController(
  request: Request,
  response: Response,
) {

  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") throw new ApiError(403, "forbidden, only passenger can book the ride");

  // velidate input
  const input = createRideRequestSchema.parse(request.body);
  if (input.pickupZoneId === input.destinationZoneId)
    throw new ApiError(400, "same_service_zone");

  // find destication location
  const [pickupZone, destinationZone] = await rideRequestRepository.findZones(
    input.pickupZoneId,
    input.destinationZoneId,
  );

  if (!pickupZone) throw new ApiError(404, "pickup_zone_not_found");
  if (!destinationZone) throw new ApiError(404, "destination_zone_not_found");

  // check this road are available or not 
  const route = resolveRouteCorridor(pickupZone.name, destinationZone.name);
  if (!route) throw new ApiError(400, "unsupported_route");

  // fare canculation to show the price
  const distanceKm = calculateDistanceKm(
    pickupZone.latitude,
    pickupZone.longitude,
    destinationZone.latitude,
    destinationZone.longitude,
  );
  const fare = calculateFare(distanceKm, input.weatherCondition);

  // create
  const rideRequest = await rideRequestRepository.create(
    request.user.id,
    input,
    fare.estimatedFare,
  );

  const driverUserId = await rideRequestRepository.findDriverUserIdByPoolId(
    input.ridePoolId,
  );
  await persistAndQueuePushNotification({
    userId: driverUserId,
    eventType: "RIDE_REQUEST_CREATED",
    title: "New ride request",
    body: "A passenger created a ride request for your pool.",
    data: { rideRequestId: rideRequest.id },
  });

  return sendSuccess(response, 201, {
    id: rideRequest.id,
    pickupZone: rideRequest.pickupZone,
    destinationZone: rideRequest.destinationZone,
    route: route.names,
    seats: rideRequest.requestedSeats,
    enableRidePool: rideRequest.enableRidePool,
    status: rideRequest.status,
    fare,
    createdAt: rideRequest.createdAt,
  });
}
