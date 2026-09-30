import { logger } from "../../../../lib/logger.js";
import { prisma } from "../../../../lib/prisma.js";
import { OpenRidePoolInput } from "../validation/ride-pool.validation.js";


const activePoolStatuses = ["OPEN"] as const;

export class RidePoolRepository {
  private fail(operation: string, error: unknown, actorId?: string) {
    logger.error("Ride pool database operation failed", {
      operation,
      actorId,
      error,
    });
  }

  async findZones(pickupZoneId: string, destinationZoneId: string) {
    try {
      return await prisma.$transaction([
        prisma.serviceZone.findUnique({ where: { id: pickupZoneId } }),
        prisma.serviceZone.findUnique({ where: { id: destinationZoneId } }),
      ]);
    } catch (error) {
      this.fail("findZones", error);
      throw error;
    }
  }

  async createForDriver(driverId: string, input: OpenRidePoolInput) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const vehicle = await transaction.vehicle.findFirst({
            where: { driverId },
            select: {
              id: true,
              name: true,
              capacity: true,
              availability: true,
            },
          });
          if (!vehicle) return { kind: "vehicle_not_found" as const };
          if (vehicle.availability !== "ONLINE") {
            return { kind: "vehicle_offline" as const };
          }

          const activePool = await transaction.ridePool.findFirst({
            where: {
              vehicleId: vehicle.id,
              status: { in: [...activePoolStatuses] },
            },
            select: { id: true },
          });
          if (activePool) return { kind: "active_pool_exists" as const };

          const pool = await transaction.ridePool.create({
            data: {
              vehicleId: vehicle.id,
              pickupZoneId: input.pickupZoneId,
              destinationZoneId: input.destinationZoneId,
              status: 'OPEN'
            },
            select: {
              id: true,
              status: true,
              reservedSeats: true,
              createdAt: true,
              updatedAt: true,
              pickupZone: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
              destinationZone: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  capacity: true,
                  availability: true,
                },
              },
            },
          });
          return { kind: "created" as const, pool };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      this.fail("createForDriver", error, driverId);
      throw error;
    }
  }

  async closeForDriver(driverUserId: string, poolId: string) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const lockedPools = await transaction.$queryRaw<
            Array<{ id: string; status: string; driverUserId: string | null }>
          >`
            SELECT
              pool."id" AS "id",
              pool."status"::text AS "status",
              driver."userId" AS "driverUserId"
            FROM "RidePool" AS pool
            INNER JOIN "Vehicle" AS vehicle ON vehicle."id" = pool."vehicleId"
            INNER JOIN "Driver" AS driver ON driver."id" = vehicle."driverId"
            WHERE pool."id" = CAST(${poolId} AS uuid)
            FOR UPDATE OF pool
          `;

          const lockedPool = lockedPools[0];
          if (!lockedPool) return { kind: "pool_not_found" as const };
          if (lockedPool.driverUserId !== driverUserId) {
            return { kind: "forbidden" as const };
          }
          if (lockedPool.status !== "OPEN") {
            return { kind: "pool_closed" as const };
          }

          const pool = await transaction.ridePool.update({
            where: { id: poolId },
            data: { status: "CLOSE" },
            select: {
              id: true,
              status: true,
              reservedSeats: true,
              createdAt: true,
              updatedAt: true,
              pickupZone: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
              destinationZone: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
              vehicle: {
                select: {
                  id: true,
                  name: true,
                  capacity: true,
                  availability: true,
                },
              },
            },
          });

          return { kind: "closed" as const, pool };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      this.fail("closeForDriver", error, driverUserId);
      throw error;
    }
  }

  async joinForPassenger(
    passengerId: string,
    rideRequestId: string,
    poolId: string,
  ) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          // Find the ride request
          const request = await transaction.rideRequest.findFirst({
            where: { id: rideRequestId, passengerId },
            select: {
              id: true,
              pickupZoneId: true,
              destinationZoneId: true,
              requestedSeats: true,
              enableRidePool: true,
              poolId: true,
              status: true,
            },
          });
          if (!request) return { kind: "request_not_found" as const };
          if (!request.enableRidePool) {
            return { kind: "request_not_joinable" as const };
          }

          // Find the ride pool 
          await transaction.$queryRaw`
            SELECT "id"
            FROM "RidePool"
            WHERE "id" = CAST(${poolId} AS uuid)
            FOR UPDATE
          `;

          const pool = await transaction.ridePool.findUnique({
            where: { id: poolId },
            select: {
              id: true,
              pickupZoneId: true,
              destinationZoneId: true,
              status: true,
              reservedSeats: true,
              vehicle: { select: { capacity: true, availability: true } },
            },
          });
          if (!pool) return { kind: "pool_not_found" as const };
          if (
            pool.status !== "OPEN" ||
            !pool.vehicle ||
            pool.vehicle.availability !== "ONLINE"
          ) {
            return { kind: "pool_closed" as const };
          }
          if (
            pool.pickupZoneId !== request.pickupZoneId ||
            pool.destinationZoneId !== request.destinationZoneId
          ) {
            return { kind: "route_mismatch" as const };
          }
          if (
            pool.reservedSeats + request.requestedSeats >
            pool.vehicle.capacity
          ) {
            return { kind: "capacity_conflict" as const };
          }

          // Perform updates and create status history
          const updatedPool = await transaction.ridePool.update({
            where: { id: pool.id },
            data: { reservedSeats: { increment: request.requestedSeats } },
            select: { id: true, reservedSeats: true },
          });

          const updatedRequest = await transaction.rideRequest.update({
            where: { id: request.id },
            data: { poolId: pool.id, status: "PENDING_DRIVER_ACCEPTANCE" },
            select: { id: true, poolId: true, status: true },
          });

          await transaction.rideStatusHistory.create({
            data: {
              requestId: request.id,
              fromStatus: request.status,
              toStatus: "PENDING_DRIVER_ACCEPTANCE",
              changedById: passengerId,
            },
          });

          return {
            kind: "joined" as const,
            pool: updatedPool,
            request: updatedRequest,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      this.fail("joinForPassenger", error, passengerId);
      throw error;
    }
  }
}

export const ridePoolRepository = new RidePoolRepository();
