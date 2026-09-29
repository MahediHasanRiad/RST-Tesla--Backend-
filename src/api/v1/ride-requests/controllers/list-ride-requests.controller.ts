import type { Request, Response } from "express";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import {
  createCursorPage,
  parseCursorQuery,
} from "../../../../shared/pagination/cursor.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";


const LIST_CACHE_TTL_SECONDS = 60;

export async function listRideRequestsController(
  request: Request,
  response: Response,
) {

  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") {
    throw new ApiError(403, "forbidden");
  }

  // cursor pagination
  const { cursor, limit, position } = parseCursorQuery(request.query);

  // cache key
  const cacheKey = `list:ride-requests:user=${encodeURIComponent(request.user.id)}:cursor=${encodeURIComponent(cursor ?? "")}:limit=${limit}`;
  let page: ReturnType<typeof createCursorPage> | undefined;

  try {
    // get data from cache
    const cached = await redis.get(cacheKey);
    if (cached)
      page = JSON.parse(cached) as ReturnType<typeof createCursorPage>;
  } 
  catch (error) {
    logger.warn("Redis cache read failed", {
      cacheKey,
      actorId: request.user.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (!page) {
    const result = await rideRequestRepository.findPageByPassenger(
      request.user.id,
      position,
      limit,
    );

    page = createCursorPage(
      result.items,
      limit,
      result.hasNextPage,
      (item:any) => ({
        createdAt: item.createdAt.toISOString(),
        id: item.id,
      }),
    );

    try {
      // set in cache
      await redis.set(
        cacheKey,
        JSON.stringify(page),
        "EX",
        LIST_CACHE_TTL_SECONDS,
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
