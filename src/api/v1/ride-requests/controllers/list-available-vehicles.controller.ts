import type { Request, Response } from "express";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import {
  createCursorPage,
  decodeCursor,
} from "../../../../shared/pagination/cursor.js";
import { resolveRouteCorridor } from "../../../../shared/ride/route-corridor.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";
import { listAvailableVehiclesSchema } from "../validation/ride-request.validation.js";

const CACHE_TTL_SECONDS = 60;

export async function listAvailableVehiclesController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") throw new ApiError(403, "forbidden");

  // input validation
  const input = listAvailableVehiclesSchema.parse(request.query);
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
  if (!resolveRouteCorridor(pickupZone.name, destinationZone.name)) {
    throw new ApiError(400, "unsupported_route");
  }

  // cache key
  const cacheKey = `list:available-vehicles:pickup=${input.pickupZoneId}:destination=${input.destinationZoneId}:seats=${input.seats}:cursor=${input.cursor ?? ""}:limit=${input.limit}`;
  let page: ReturnType<typeof createCursorPage> | undefined;
  try {
    // get from cache
    const cached = await redis.get(cacheKey);
    if (cached)
      page = JSON.parse(cached) as ReturnType<typeof createCursorPage>;
  } catch (error) {
    logger.warn("Redis cache read failed", {
      cacheKey,
      actorId: request.user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  if (!page) {
    const availableVehicles = await rideRequestRepository.findAvailableVehiclesByRoute();
    const vehicles = availableVehicles
      .filter((vehicle) => vehicle.availability === "ONLINE")
      .map((vehicle) => ({
        poolId: null,
        vehicleId: vehicle.id,
        vehicle,
        reservedSeats: 0,
        availableSeats: vehicle.capacity,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt,
      }))
      .filter((item) => item.availableSeats >= input.seats);

    // set pagination
    const position = input.cursor ? decodeCursor(input.cursor) : undefined;
    const firstIndex = position
      ? Math.max(
          vehicles.findIndex(
            (item) =>
              item.createdAt > new Date(position.createdAt) ||
              (item.createdAt.getTime() ===
                new Date(position.createdAt).getTime() &&
                item.vehicleId > position.id),
          ),
          0,
        )
      : 0;
    const items = vehicles.slice(firstIndex, firstIndex + input.limit);
    page = createCursorPage(
      items,
      input.limit,
      firstIndex + input.limit < vehicles.length,
      (item) => ({ createdAt: item.createdAt.toISOString(), id: item.vehicleId }),
    );
    try {
      // set in cache
      await redis.set(cacheKey, JSON.stringify(page), "EX", CACHE_TTL_SECONDS);
    } 
    catch (error) {
      logger.warn("Redis cache write failed", {
        cacheKey,
        actorId: request.user.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  return sendSuccess(response, 200, page);
}
