import { Redis } from "ioredis";

import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

export async function disconnectRedis() {
  if (redis.status !== "wait" && redis.status !== "end") {
    await redis.quit();
  }
}
