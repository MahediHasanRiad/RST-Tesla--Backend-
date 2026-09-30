import cluster from "node:cluster";
import { createServer } from "node:http";
import { setupMaster } from "@socket.io/sticky";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { getClusterWorkerCount } from "./runtime/cluster-config.js";

const workerCount = getClusterWorkerCount(env.CLUSTER_WORKERS);
let shuttingDown = false;

// setup node cluster
if (cluster.isPrimary) {
  const httpServer = createServer();
  setupMaster(httpServer, { loadBalancingMethod: "least-connection" });
  httpServer.listen(env.PORT, () => {
    logger.info("API primary listening", {
      port: env.PORT,
      workerCount,
      processId: process.pid,
    });
  });

  for (let index = 0; index < workerCount - 1; index += 1) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    logger.warn("API worker exited", {
      workerId: worker.id,
      processId: worker.process.pid,
      code,
      signal,
      restarting: !shuttingDown,
    });
    if (!shuttingDown) cluster.fork();
  });

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down API primary process", { signal });
    httpServer.close();
    for (const worker of Object.values(cluster.workers ?? {})) worker?.disconnect();
    setTimeout(() => process.exit(0), 10_000).unref();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

} else {
  // call redis adapter
  void import("./worker-server.js")
    .then(({ startWorker }) => startWorker())
    .catch((error) => {
      logger.error("API worker failed to start", {
        processId: process.pid,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}
