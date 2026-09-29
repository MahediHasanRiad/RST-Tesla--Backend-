import type { Request, Response } from "express";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { counterFareRedisKey, COUNTER_FARE_TTL_SECONDS } from "../ride-request.negotiation.js";
import { counterFareSchema, rideRequestIdParamsSchema } from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";


const negotiableStatuses = new Set([
  "REQUESTED",
  "PENDING_DRIVER_ACCEPTANCE",
]);

export async function counterFareRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER" && request.user.role !== "DRIVER") {
    throw new ApiError(403, "forbidden");
  }

  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const { farePaisa } = counterFareSchema.parse(request.body);
  const context = await rideRequestRepository.findFareNegotiationContext(
    rideRequestId,
  );

  if (!context) throw new ApiError(404, "ride_request_not_found");
  if (!negotiableStatuses.has(context.status)) {
    throw new ApiError(409, "ride_request_cannot_counter_fare");
  }

  const isPassenger = context.passengerId === request.user.id;
  const isDriver = context.pool?.vehicle.driver.userId === request.user.id;
  if (!isPassenger && !isDriver) throw new ApiError(403, "forbidden");

  const cacheKey = counterFareRedisKey(rideRequestId);
  try {
    await redis.set(
      cacheKey,
      String(farePaisa),
      "EX",
      COUNTER_FARE_TTL_SECONDS,
    );
  } catch (error) {
    logger.warn("Redis counter fare write failed", {
      cacheKey,
      actorId: request.user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw new ApiError(503, "counter_fare_unavailable");
  }

  return sendSuccess(response, 200, {
    rideRequestId,
    farePaisa,
    status: context.status,
    persisted: false,
  });
}
