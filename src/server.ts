import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./lib/prisma.js";
import { disconnectRedis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
import { attachDriverPresence } from "./realtime/driver-presence.js";

const app = buildApp();
const httpServer = createServer(app);

const socketServer = new SocketIOServer(httpServer, {
  cors: { origin: false },
});
attachDriverPresence(socketServer);

const shutdown = async (signal: string) => {
  logger.info("Shutting down API", { signal });
  httpServer.close();
  await Promise.all([
    socketServer.close(),
    disconnectDatabase(),
    disconnectRedis(),
  ]);
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

httpServer.listen(env.PORT, () => {
  console.log(`Server on port ${env.PORT}`)
});
