import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./lib/prisma.js";
import { disconnectRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";

const app = buildApp();

const shutdown = async (signal: string) => {
  logger.info("Shutting down API", { signal });
  server?.close();
  await Promise.all([disconnectDatabase(), disconnectRedis()]);
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

const server = app.listen(env.PORT, () => {
  console.log(`Server on port ${env.PORT}`)
});
