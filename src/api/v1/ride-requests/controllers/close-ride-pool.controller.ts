import type { Request, Response } from "express";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { closeRidePoolSchema } from "../validation/ride-pool.validation.js";
import { ridePoolRepository } from "../repository/ride-pool.repository.js";
import {
  availableRidePoolVersionKey,
  AVAILABLE_RIDE_POOL_VERSION_TTL_SECONDS,
} from "../ride-pool.cache.js";

export async function closeRidePoolController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  // input validation
  const { poolId } = closeRidePoolSchema.parse(request.body);
  const result = await ridePoolRepository.closeForDriver(
    request.user.id,
    poolId,
  );

  if (result.kind === "pool_not_found") {
    throw new ApiError(404, "ride_pool_not_found");
  }
  if (result.kind === "forbidden") {
    throw new ApiError(403, "forbidden");
  }
  if (result.kind === "pool_closed") {
    throw new ApiError(409, "ride_pool_not_open");
  }

  // cache key
  const cacheVersionKey = availableRidePoolVersionKey(
    result.pool.pickupZone.id,
    result.pool.destinationZone.id,
  );
  try {
    // add incr bcs, when drive close the pool the imidiately update the version, then also 
    // remove from the cache 
    await redis.incr(cacheVersionKey);
    await redis.expire(cacheVersionKey, AVAILABLE_RIDE_POOL_VERSION_TTL_SECONDS);
  } 
  catch (error) {
    logger.warn("Ride-pool discovery cache invalidation failed", {
      cacheVersionKey,
      actorId: request.user.id,
      poolId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return sendSuccess(response, 200, result.pool);
}
