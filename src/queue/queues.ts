import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import type { EmailJobData, PushNotificationJobData } from "./types.js";

const queueOptions = {
  attempts: env.QUEUE_MAX_ATTEMPTS,
  backoff: { type: "exponential" as const, delay: env.QUEUE_BACKOFF_MS },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export function createQueueConnection() {
  return new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}

let notificationQueue: Queue<PushNotificationJobData> | undefined;
let emailQueue: Queue<EmailJobData> | undefined;

export function getNotificationQueue() {
  return notificationQueue ??= new Queue<PushNotificationJobData>(
    "push-notifications",
    { connection: createQueueConnection(), defaultJobOptions: queueOptions },
  );
}

export function getEmailQueue() {
  return emailQueue ??= new Queue<EmailJobData>("emails", {
    connection: createQueueConnection(),
    defaultJobOptions: queueOptions,
  });
}

export async function enqueueEmail(data: EmailJobData) {
  return getEmailQueue().add("send-email", data, {
    jobId: `${data.purpose}:${data.email}:${data.otp}`,
  });
}

export async function enqueuePushNotification(data: PushNotificationJobData) {
  return getNotificationQueue().add("send-push-notification", data);
}

export async function closeQueues() {
  await Promise.all([
    notificationQueue?.close(),
    emailQueue?.close(),
  ]);
}
