import type { Request, Response } from "express";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { createOffsetPage } from "../../../../shared/pagination/offset.js";
import { completedRideHistoryQuerySchema } from "../../ride-requests/validation/ride-request.validation.js";
import { rideRequestRepository } from "../../ride-requests/repository/ride-request.repository.js";


const LIST_CACHE_TTL_SECONDS = 60;

export async function listDriverCompletedRideRequestsController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  const { page: pageNumber, limit } = completedRideHistoryQuerySchema.parse(
    request.query,
  );
  const cacheKey = `list:v1:driver-completed-ride-requests:driver=${encodeURIComponent(request.user.id)}:page=${pageNumber}:limit=${limit}`;
  let page: ReturnType<typeof createOffsetPage> | undefined;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) page = JSON.parse(cached) as ReturnType<typeof createOffsetPage>;
  } catch (error) {
    logger.warn("Redis cache read failed", {
      cacheKey,
      actorId: request.user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (!page) {
    const result = await rideRequestRepository.findCompletedPageByDriver(
      request.user.id,
      pageNumber,
      limit,
    );
    page = createOffsetPage(result.items, pageNumber, limit, result.totalItems);

    try {
      await redis.set(cacheKey, JSON.stringify(page), "EX", LIST_CACHE_TTL_SECONDS);
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
