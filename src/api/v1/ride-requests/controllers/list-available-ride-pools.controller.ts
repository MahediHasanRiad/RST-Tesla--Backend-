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
import { listAvailableRidePoolsSchema } from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";
import {
  availableRidePoolCacheKey,
  availableRidePoolVersionKey,
  AVAILABLE_RIDE_POOL_CACHE_TTL_SECONDS,
} from "../ride-pool.cache.js";

export async function listAvailableRidePoolsController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") {
    throw new ApiError(403, "forbidden, only passenger can access");
  }

  // input validation
  const input = listAvailableRidePoolsSchema.parse(request.body);
  if (input.pickupZoneId === input.destinationZoneId) {
    throw new ApiError(400, "same_service_zone");
  }

  // location verify
  const [pickupZone, destinationZone] = await rideRequestRepository.findZones(
    input.pickupZoneId,
    input.destinationZoneId,
  );
  if (!pickupZone) throw new ApiError(404, "pickup_zone_not_found");
  if (!destinationZone) throw new ApiError(404, "destination_zone_not_found");

  // check the reserved location
  const requestedRoute = resolveRouteCorridor(
    pickupZone.name,
    destinationZone.name,
  );
  if (!requestedRoute) throw new ApiError(400, "unsupported_route");

  // cache key
  let cacheVersion = "0";
  try {
    cacheVersion =
      (await redis.get(
        availableRidePoolVersionKey(
          input.pickupZoneId,
          input.destinationZoneId,
        ),
      )) ?? "0";
  } catch (error) {
    logger.warn("Redis cache version read failed", {
      actorId: request.user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  // redis cache key
  const cacheKey = availableRidePoolCacheKey({
    version: cacheVersion,
    pickupZoneId: input.pickupZoneId,
    destinationZoneId: input.destinationZoneId,
    seats: input.seats,
    cursor: input.cursor,
    limit: input.limit,
  });
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
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (!page) {
    const pools = await rideRequestRepository.findAvailablePoolsByRoute(
      input.pickupZoneId,
      input.destinationZoneId,
    );

    const compatiblePools = pools
      .map((pool:any) => {
        const availableSeats = Math.max(
          pool.vehicle.capacity - pool.reservedSeats,
          0,
        );

        return {
          id: pool.id,
          status: pool.status,
          pickupZone: pool.pickupZone,
          vehicle: pool.vehicle,
          reservedSeats: pool.reservedSeats,
          availableSeats,
          destinationZone: pool.destinationZone,
          createdAt: pool.createdAt,
          updatedAt: pool.updatedAt,
        };
      })
      .filter((pool:any) => pool.availableSeats >= input.seats);

    // cursor pagination
    const position = input.cursor ? decodeCursor(input.cursor) : undefined;
    const startIndex = position
      ? compatiblePools.findIndex(
          (pool:any) =>
            pool.createdAt > new Date(position.createdAt) ||
            (pool.createdAt.getTime() ===
              new Date(position.createdAt).getTime() &&
              pool.id > position.id),
        )
      : 0;
    const firstIndex = position
      ? startIndex < 0
        ? compatiblePools.length
        : startIndex
      : 0;
    const items = compatiblePools.slice(firstIndex, firstIndex + input.limit);
    const hasNextPage = firstIndex + input.limit < compatiblePools.length;

    page = createCursorPage(items, input.limit, hasNextPage, (item:any) => ({
      createdAt: item.createdAt.toISOString(),
      id: item.id,
    }));

    try {
      // set in redis
      await redis.set(
        cacheKey,
        JSON.stringify(page),
        "EX",
        AVAILABLE_RIDE_POOL_CACHE_TTL_SECONDS,
      );
    } catch (error) {
      logger.warn("Redis cache write failed", {
        cacheKey,
        actorId: request.user.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return sendSuccess(response, 200, page);
}
