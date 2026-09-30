import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

export function createRedisClient() {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  client.on("error", (error) => {
    logger.warn("Redis connection error", { error });
  });
  return client;
}

redis.on("error", (error) => {
  logger.warn("Redis connection error", { error });
});

export async function disconnectRedis() {
  if (redis.status !== "wait" && redis.status !== "end") {
    await redis.quit();
  }
}
