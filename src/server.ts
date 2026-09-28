import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./lib/prisma.js";
import { disconnectRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";

const app = await buildApp();

const shutdown = async (signal: string) => {
  logger.info("Shutting down API", { signal });
  await app.close();
  await Promise.all([disconnectDatabase(), disconnectRedis()]);
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ host: "0.0.0.0", port: env.PORT });
