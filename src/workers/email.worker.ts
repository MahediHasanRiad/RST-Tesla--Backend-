import { Worker } from "bullmq";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger.js";
import { createQueueConnection } from "../queue/queues.js";
import type { EmailJobData } from "../queue/types.js";
import { sendOtpMail } from "../shared/auth/brevo.js";
import { env } from "../config/env.js";

export function createEmailWorker() {
  const worker = new Worker<EmailJobData>(
    "emails",
    async (job) => {
      await sendOtpMail(job.data);
    },
    {
      connection: createQueueConnection(),
      concurrency: env.QUEUE_EMAIL_CONCURRENCY,
    },
  );

  worker.on("failed", (job, error) => {
    logger.warn("Email job failed", {
      jobId: job?.id,
      errorName: error.name,
      errorMessage: error.message,
    });
  });
  return worker;
}

export async function startEmailWorker() {
  const worker = createEmailWorker();
  const shutdown = async (signal: string) => {
    logger.info("Shutting down email worker", { signal });
    await worker.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  return worker;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startEmailWorker();
}
