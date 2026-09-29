import { PoolStatus } from "../../../generated/prisma/client.js";
import { logger } from "../../../lib/logger.js";
import { prisma } from "../../../lib/prisma.js";
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
} from "./vehicle.validation.js";

const activePoolStatuses: PoolStatus[] = [
  "OPEN",
  "PENDING_DRIVER_ACCEPTANCE",
  "MATCHED",
  "DRIVER_ARRIVED",
  "STARTED",
];

export class VehicleRepository {
  private fail(operation: string, error: unknown, actorId?: string) {
    logger.error("Vehicle database operation failed", {
      operation,
      actorId,
      error,
    });
  }

  async findDriverByUserId(userId: string) {
    try {
      return await prisma.driver.findUnique({
        where: { userId },
        select: { id: true, userId: true },
      });
    } catch (error) {
      this.fail("findDriverByUserId", error, userId);
      throw error;
    }
  }

  async findById(vehicleId: string) {
    try {
      return await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    } catch (error) {
      this.fail("findById", error, vehicleId);
      throw error;
    }
  }

  async findByDriverId(driverId: string) {
    try {
      return await prisma.vehicle.findUnique({ where: { driverId } });
    } catch (error) {
      this.fail("findByDriverId", error, driverId);
      throw error;
    }
  }

  async create(
    driverId: string,
    data: Omit<CreateVehicleInput, "images"> & { images: string[] },
  ) {
    try {
      return await prisma.vehicle.create({ data: { driverId, ...data } });
    } catch (error) {
      this.fail("create", error, driverId);
      throw error;
    }
  }
  async update(
    driverId: string,
    data: Omit<UpdateVehicleInput, "images"> & { images?: string[] },
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({
          where: { driverId },
          select: { id: true },
        });
        if (!vehicle) return { kind: "missing" as const };
        await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${vehicle.id} FOR UPDATE`;
        if (data.capacity !== undefined) {
          const pool = await tx.ridePool.findFirst({
            where: {
              vehicleId: vehicle.id,
              status: { in: activePoolStatuses },
              reservedSeats: { gt: data.capacity },
            },
            select: { id: true },
          });
          if (pool) return { kind: "capacity_conflict" as const };
        }
        return {
          kind: "updated" as const,
          vehicle: await tx.vehicle.update({ where: { id: vehicle.id }, data }),
        };
      });
    } catch (error) {
      this.fail("update", error, driverId);
      throw error;
    }
  }
  async delete(driverId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({
          where: { driverId },
          select: { id: true },
        });
        if (!vehicle) return "missing" as const;
        if (
          await tx.ridePool.findFirst({
            where: { vehicleId: vehicle.id },
            select: { id: true },
          })
        )
          return "has_pools" as const;
        await tx.vehicle.delete({ where: { id: vehicle.id } });
        return "deleted" as const;
      });
    } catch (error) {
      this.fail("delete", error, driverId);
      throw error;
    }
  }
}
export const vehicleRepository = new VehicleRepository();
