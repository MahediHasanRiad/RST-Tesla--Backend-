import { logger } from "../../lib/logger.js";
import { notificationRepository } from "../../api/v1/users/notification.repository.js";
import { enqueuePushNotification } from "../../queue/queues.js";

export type RideNotificationEvent =
  | "RIDE_REQUEST_CREATED"
  | "RIDE_MATCHED"
  | "RIDE_CANCELLED"
  | "COUNTER_FARE_UPDATED";

export async function persistAndQueuePushNotification(input: {
  userId: string | null | undefined;
  eventType: RideNotificationEvent;
  title: string;
  body: string;
  data: Record<string, string>;
}) {
  if (!input.userId) return;

  try {
    const notification = await notificationRepository.create({
      userId: input.userId,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      data: input.data,
    });

    await enqueuePushNotification({
      notificationId: notification.id,
      userId: input.userId,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      data: input.data,
    });
  } catch (error) {
    logger.warn("Push notification enqueue failed", {
      userId: input.userId,
      eventType: input.eventType,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
