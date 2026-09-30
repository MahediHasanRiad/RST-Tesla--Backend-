import { Server as SocketIOServer } from "socket.io";
import { setupWorker } from "@socket.io/sticky";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer } from "node:http";
import { buildApp } from "./app.js";
import { disconnectDatabase } from "./lib/prisma.js";
import { createRedisClient, disconnectRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
import { attachDriverPresence } from "./realtime/driver-presence.js";

export async function configureRedisAdapter(
  io: SocketIOServer,
  createClient = createRedisClient,
) {
  const publisher = createClient();
  const subscriber = publisher.duplicate();

  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
    io.adapter(createAdapter(publisher, subscriber));
    return { publisher, subscriber };
  } catch (error) {
    logger.warn("Socket.IO Redis adapter unavailable; using local-worker events", {
      processId: process.pid,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    publisher.disconnect();
    subscriber.disconnect();
    return undefined;
  }
}

export async function startWorker() {
  const app = buildApp();
  const httpServer = createServer(app);
  const socketServer = new SocketIOServer(httpServer, {
    cors: { origin: false },
  });
  const redisClients = await configureRedisAdapter(socketServer);

  setupWorker(socketServer);
  attachDriverPresence(socketServer);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down API worker", {
      signal,
      processId: process.pid,
    });
    await Promise.all([
      socketServer.close(),
      redisClients?.publisher.quit(),
      redisClients?.subscriber.quit(),
      disconnectDatabase(),
      disconnectRedis(),
    ]);
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
