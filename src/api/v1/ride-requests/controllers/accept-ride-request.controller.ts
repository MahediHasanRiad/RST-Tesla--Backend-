import type { Request, Response } from "express";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { counterFareRedisKey } from "../ride-request.negotiation.js";
import { rideRequestIdParamsSchema } from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";


function parseCachedFare(value: string | null) {
  if (!value) return undefined;
  const farePaisa = Number(value);
  return Number.isSafeInteger(farePaisa) && farePaisa > 0
    ? farePaisa
    : undefined;
}

export async function acceptRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const cacheKey = counterFareRedisKey(rideRequestId);
  let counterFarePaisa: number | undefined;

  try {
    counterFarePaisa = parseCachedFare(await redis.get(cacheKey));
  } catch (error) {
    logger.warn("Redis counter fare read failed during acceptance", {
      cacheKey,
      actorId: request.user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const result = await rideRequestRepository.acceptForDriver(
    rideRequestId,
    request.user.id,
    counterFarePaisa,
  );
  if (result.kind === "not_found") {
    throw new ApiError(404, "ride_request_not_found_or_not_pending");
  }

  try {
    await redis.del(cacheKey);
  } catch (error) {
    logger.warn("Redis counter fare cleanup failed after acceptance", {
      cacheKey,
      actorId: request.user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return sendSuccess(response, 200, result.request);
}
