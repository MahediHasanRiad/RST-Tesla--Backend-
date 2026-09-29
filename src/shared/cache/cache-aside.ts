import { logger } from "../../lib/logger.js";
import { redis } from "../../lib/redis.js";

export const LIST_CACHE_TTL_SECONDS = 60;

export function buildListCacheKey(
  resource: string,
  values: Record<string, string | number | null | undefined>,
) {
  const suffix = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value ?? ""))}`)
    .join(":");
  return `list:v2:${resource}:${suffix}`;
}

export async function cacheAside<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = LIST_CACHE_TTL_SECONDS,
) {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch (error) {
    logger.warn("Redis cache read failed", {
      cacheKey: key,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const value = await loader();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    logger.warn("Redis cache write failed", {
      cacheKey: key,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  
  return value;
}
