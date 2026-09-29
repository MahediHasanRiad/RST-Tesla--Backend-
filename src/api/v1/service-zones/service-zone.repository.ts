import { logger } from "../../../lib/logger.js";
import { prisma } from "../../../lib/prisma.js";
import type { CursorPosition } from "../../../shared/pagination/cursor.js";

export class ServiceZoneRepository {
  private fail(operation: string, error: unknown) {
    logger.error("Service zone database operation failed", {
      operation,
      error,
    });
  }

  async findPage(cursor: CursorPosition | undefined, limit: number) {
    try {
      const zones = await prisma.serviceZone.findMany({
        where: cursor
          ? {
              OR: [
                { createdAt: { gt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { gt: cursor.id },
                },
              ],
            }
          : undefined,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          createdAt: true,
        },
      });
      return { items: zones.slice(0, limit), hasNextPage: zones.length > limit };
    } catch (error) {
      this.fail("findPage", error);
      throw error;
    }
  }
}

export const serviceZoneRepository = new ServiceZoneRepository();
