import assert from "node:assert/strict";
import test from "node:test";
import { notificationRepository } from "../src/api/v1/users/notification.repository.js";
import { prisma } from "../src/lib/prisma.js";

test("notification repository scopes reads and read updates to the owner", async () => {
  const notification = prisma.notification as unknown as Record<string, unknown>;
  const originalFindMany = notification.findMany;
  const originalUpdateMany = notification.updateMany;
  let findWhere: unknown;
  let updateWhere: unknown;

  notification.findMany = async (args: { where: unknown }) => {
    findWhere = args.where;
    return [];
  };
  notification.updateMany = async (args: { where: unknown }) => {
    updateWhere = args.where;
    return { count: 1 };
  };

  try {
    await notificationRepository.listForUser("user-1", true);
    await notificationRepository.markRead("user-1", "notification-1");
  } finally {
    notification.findMany = originalFindMany;
    notification.updateMany = originalUpdateMany;
  }

  assert.deepEqual(findWhere, { userId: "user-1", isRead: false });
  assert.deepEqual(updateWhere, {
    id: "notification-1",
    userId: "user-1",
    isRead: false,
  });
});
