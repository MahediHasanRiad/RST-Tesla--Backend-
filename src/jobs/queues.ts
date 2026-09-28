import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";

// Jobs are for asynchronous side effects only. Ride capacity stays in PostgreSQL.
const queueConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const notificationQueue = new Queue("notifications", {
  connection: queueConnection
});
