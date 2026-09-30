import { prisma } from "../../../lib/prisma.js";

export class DeviceTokenRepository {
  async upsert(userId: string, token: string, platform: string) {
    return prisma.userDeviceToken.upsert({
      where: { token },
      create: { userId, token, platform, isActive: true },
      update: { userId, platform, isActive: true, lastSeenAt: new Date() },
      select: { id: true, token: true, platform: true, isActive: true },
    });
  }

  async remove(userId: string, token: string) {
    return prisma.userDeviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }

  async listActiveByUserId(userId: string) {
    return prisma.userDeviceToken.findMany({
      where: { userId, isActive: true },
      select: { id: true, token: true },
    });
  }

  async disableToken(token: string) {
    return prisma.userDeviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }
}

export const deviceTokenRepository = new DeviceTokenRepository();
