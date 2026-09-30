import { Worker } from "bullmq";
import { fileURLToPath } from "node:url";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { logger } from "../lib/logger.js";
import { createQueueConnection } from "../queue/queues.js";
import type { PushNotificationJobData } from "../queue/types.js";
import { env } from "../config/env.js";
import { deviceTokenRepository } from "../api/v1/users/device-token.repository.js";

export function createFirebaseMessaging(): Messaging {
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
  return getMessaging(app);
}

function isInvalidTokenError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
  return code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token";
}

export function createNotificationWorker(messaging = createFirebaseMessaging()) {
  const worker = new Worker<PushNotificationJobData>(
    "push-notifications",
    async (job) => {
      const tokens = await deviceTokenRepository.listActiveByUserId(job.data.userId);
      for (const device of tokens) {
        try {
          await messaging.send({
            token: device.token,
            notification: { title: job.data.title, body: job.data.body },
            data: {
              eventType: job.data.eventType,
              ...(job.data.data ?? {}),
            },
          });
        } catch (error) {
          if (isInvalidTokenError(error)) await deviceTokenRepository.disableToken(device.token);
          else throw error;
        }
      }
    },
    {
      connection: createQueueConnection(),
      concurrency: env.QUEUE_NOTIFICATION_CONCURRENCY,
    },
  );

  worker.on("failed", (job, error) => {
    logger.warn("Push notification job failed", {
      jobId: job?.id,
      errorName: error.name,
      errorMessage: error.message,
    });
  });
  return worker;
}

export async function startNotificationWorker() {
  const worker = createNotificationWorker();
  const shutdown = async (signal: string) => {
    logger.info("Shutting down notification worker", { signal });
    await worker.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  return worker;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startNotificationWorker();
}
