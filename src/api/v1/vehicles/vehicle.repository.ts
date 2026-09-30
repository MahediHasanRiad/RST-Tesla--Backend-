import { PoolStatus, VehicleAvailability } from "../../../generated/prisma/client.js";
import { logger } from "../../../lib/logger.js";
import { prisma } from "../../../lib/prisma.js";
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
} from "./vehicle.validation.js";

const activePoolStatuses: PoolStatus[] = [
  "OPEN",
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
      return await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        include: { driver: { select: { userId: true } } },
      });
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

  async setAvailabilityForDriver(
    driverId: string,
    availability: VehicleAvailability,
  ) {
    try {
      const vehicle = await prisma.vehicle.findUnique({
        where: { driverId },
        select: { id: true },
      });
      if (!vehicle) return { kind: "missing" as const };

      return {
        kind: "updated" as const,
        vehicle: await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { availability },
          select: { id: true, availability: true },
        }),
      };
    } catch (error) {
      this.fail("setAvailabilityForDriver", error, driverId);
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
      return await prisma.$transaction(
        async (tx) => {
          // 1. Find the vehicle
          const vehicle = await tx.vehicle.findUnique({
            where: { driverId },
            select: { id: true },
          });

          if (!vehicle) return { kind: "missing" as const };

          // 2. Check capacity conflict with active ride pools if capacity is being updated
          if (data.capacity !== undefined) {
            const conflictingPool = await tx.ridePool.findFirst({
              where: {
                vehicleId: vehicle.id,
                status: { in: activePoolStatuses },
                reservedSeats: { gt: data.capacity },
              },
              select: { id: true },
            });

            if (conflictingPool) return { kind: "capacity_conflict" as const };
          }

          // 3. Perform the update using pure Prisma
          const updatedVehicle = await tx.vehicle.update({
            where: { id: vehicle.id },
            data,
          });

          return {
            kind: "updated" as const,
            vehicle: updatedVehicle,
          };
        },
        {
          // Optional: Set isolation level to Serializable for strict concurrency safety without raw locks
          isolationLevel: "Serializable",
        },
      );
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
