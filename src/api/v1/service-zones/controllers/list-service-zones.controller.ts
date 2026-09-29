import type { Request, Response } from "express";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import {
  createCursorPage,
  parseCursorQuery,
} from "../../../../shared/pagination/cursor.js";
import { serviceZoneRepository } from "../service-zone.repository.js";

const LIST_CACHE_TTL_SECONDS = 60;

export async function listServiceZonesController(
  request: Request,
  response: Response,
) {
  const { cursor, limit, position } = parseCursorQuery(request.query);

  const cacheKey = `list:service-zones:cursor=${encodeURIComponent(cursor ?? "")}:limit=${limit}`;
  let page: ReturnType<typeof createCursorPage> | undefined;

  try {
    // get from redis cache
    const cached = await redis.get(cacheKey);
    if (cached) page = JSON.parse(cached) as ReturnType<typeof createCursorPage>;
  } 
  catch (error) {
    logger.warn("Redis cache read failed", {
      cacheKey,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  if (!page) {
    const result = await serviceZoneRepository.findPage(position, limit);
    const items = result.items.map(
      ({ createdAt: _createdAt, ...zone }) => zone,
    );

    page = createCursorPage(items, limit, result.hasNextPage, (item) => {
      const source = result.items.find((candidate) => candidate.id === item.id);
      if (!source) throw new Error("Cursor source item missing");
      return { createdAt: source.createdAt.toISOString(), id: source.id };
    });

    try {
      // set in redis
      await redis.set(
        cacheKey,
        JSON.stringify(page),
        "EX",
        LIST_CACHE_TTL_SECONDS,
      );
    } catch (error) {
      logger.warn("Redis cache write failed", {
        cacheKey,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return sendSuccess(response, 200, page);
}
