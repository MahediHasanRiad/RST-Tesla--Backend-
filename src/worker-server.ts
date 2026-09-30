import { Server } from "socket.io";
import { setupWorker } from "@socket.io/sticky";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer } from "node:http";

import { buildApp } from "./app.js";
import { createRedisClient } from "./lib/redis.js";
import { attachDriverPresence } from "./realtime/driver-presence.js";
import { attachRideStatus } from "./realtime/ride-status.js";

export async function startWorker() {
  const app = buildApp();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: false,
    },
  });

  // Redis adapter
  const pubClient = createRedisClient();
  const subClient = pubClient.duplicate();

  await Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]);

  io.adapter(createAdapter(pubClient, subClient));

  // Cluster sticky sessions
  setupWorker(io);

  // Application socket events
  attachDriverPresence(io);
  attachRideStatus(io);

  const shutdown = async () => {
    await io.close();

    await Promise.all([
      pubClient.quit(),
      subClient.quit(),
    ]);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
