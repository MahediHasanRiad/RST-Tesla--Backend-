import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: false });
  await app.register(helmet);

  app.addHook("onRequest", async (request) => {
    logger.info("Request received", { requestId: request.id, method: request.method, url: request.url });
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (redis.status === "wait") await redis.connect();
      await redis.ping();
      return { status: "ready" };
    } catch (error) {
      logger.error("Dependency readiness check failed", { error });
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  return app;
}
