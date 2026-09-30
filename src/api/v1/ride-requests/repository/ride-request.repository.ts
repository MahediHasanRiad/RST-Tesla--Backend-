import { logger } from "../../../../lib/logger.js";
import { prisma } from "../../../../lib/prisma.js";
import { CursorPosition } from "../../../../shared/pagination/cursor.js";
import {
  CreateRideRequestInput,
  FreshRideRequestInput,
} from "../validation/ride-request.validation.js";

export class RideRequestRepository {
  private fail(operation: string, error: unknown, actorId?: string) {
    logger.error("Ride request database operation failed", {
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

  async create(
    passengerId: string,
    input: CreateRideRequestInput,
    farePaisa: number,
  ) {
    try {
      return await prisma.rideRequest.create({
        data: {
          poolId: input.ridePoolId,
          passengerId,
          status: "PENDING_DRIVER_ACCEPTANCE",
          pickupZoneId: input.pickupZoneId,
          destinationZoneId: input.destinationZoneId,
          requestedSeats: input.seats,
          enableRidePool: input.enableRidePool,
          farePaisa,
        },
        include: {
          pickupZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
        },
      });
    } catch (error) {
      this.fail("create", error, passengerId);
      throw error;
    }
  }

  async createFresh(
    passengerId: string,
    input: FreshRideRequestInput,
    farePaisa: number,
  ) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          // Fetch vehicle
          const vehicle = await transaction.vehicle.findUnique({
            where: { id: input.vehicleId },
            select: {
              id: true,
              name: true,
              capacity: true,
              availability: true,
            },
          });

          if (!vehicle) {
            return { kind: "vehicle_not_found" as const };
          }
          if (input.seats > vehicle.capacity) {
            return { kind: "capacity_conflict" as const };
          }

          let pool;
          if (input.enableRidePool) {
            // Find existing open pool for ride-pooling
            const existingPool = await transaction.ridePool.findFirst({
              where: {
                vehicleId: input.vehicleId,
                pickupZoneId: input.pickupZoneId,
                destinationZoneId: input.destinationZoneId,
                status: "OPEN",
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: { id: true },
            });

            if (!existingPool) return { kind: "pool_not_found" as const };

            const currentPool = await transaction.ridePool.findUnique({
              where: { id: existingPool.id },
              select: { id: true, status: true, reservedSeats: true },
            });

            if (!currentPool || currentPool.status !== "OPEN") {
              return { kind: "pool_not_found" as const };
            }
            if (currentPool.reservedSeats + input.seats > vehicle.capacity) {
              return { kind: "capacity_conflict" as const };
            }

            pool = await transaction.ridePool.update({
              where: { id: currentPool.id },
              data: { reservedSeats: { increment: input.seats } },
              select: {
                id: true,
                status: true,
                reservedSeats: true,
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
          } else {
            // Ensure no conflicting open pools exist for non-pooled ride requests
            const conflictingPool = await transaction.ridePool.findFirst({
              where: {
                vehicleId: input.vehicleId,
                status: "OPEN",
              },
              select: { id: true },
            });
            if (conflictingPool) return { kind: "pool_conflict" as const };

            pool = await transaction.ridePool.create({
              data: {
                vehicleId: input.vehicleId,
                pickupZoneId: input.pickupZoneId,
                destinationZoneId: input.destinationZoneId,
                status: "CLOSE",
                reservedSeats: input.seats,
              },
              select: {
                id: true,
                status: true,
                reservedSeats: true,
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
          }

          // Create the ride request
          const request = await transaction.rideRequest.create({
            data: {
              poolId: pool.id,
              passengerId,
              pickupZoneId: input.pickupZoneId,
              destinationZoneId: input.destinationZoneId,
              requestedSeats: input.seats,
              enableRidePool: input.enableRidePool,
              farePaisa,
            },
            include: {
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
            },
          });

          return { kind: "created" as const, pool, request };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      this.fail("createFresh", error, passengerId);
      throw error;
    }
  }

  async findPageByPassenger(
    passengerId: string,
    cursor: CursorPosition | undefined,
    limit: number,
  ) {
    try {
      const requests = await prisma.rideRequest.findMany({
        where: {
          passengerId,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { gt: new Date(cursor.createdAt) } },
                  {
                    createdAt: new Date(cursor.createdAt),
                    id: { gt: cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        select: {
          id: true,
          poolId: true,
          requestedSeats: true,
          status: true,
          farePaisa: true,
          createdAt: true,
          updatedAt: true,
          pickupZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
        },
      });

      return {
        items: requests.slice(0, limit),
        hasNextPage: requests.length > limit,
      };
    } catch (error) {
      this.fail("findPageByPassenger", error, passengerId);
      throw error;
    }
  }

  async findAvailablePoolsByRoute(
    pickupZoneId: string,
    destinationZoneId: string,
  ) {
    try {
      return await prisma.ridePool.findMany({
        where: {
          pickupZoneId,
          destinationZoneId,
          status: "OPEN",
          vehicle: { availability: "ONLINE" },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          reservedSeats: true,
          createdAt: true,
          updatedAt: true,
          pickupZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          vehicle: {
            select: {
              id: true,
              name: true,
              capacity: true,
              availability: true,
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
        },
      });
    } catch (error) {
      this.fail("findAvailablePoolsByRoute", error);
      throw error;
    }
  }

  async findAvailableVehiclesByRoute() {
    try {
      return await prisma.vehicle.findMany({
        where: { availability: "ONLINE" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          capacity: true,
          availability: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.fail("findAvailableVehiclesByRoute", error);
      throw error;
    }
  }

  async findByIdForPassenger(rideRequestId: string, passengerId: string) {
    try {
      return await prisma.rideRequest.findFirst({
        where: { id: rideRequestId, passengerId },
        select: {
          id: true,
          poolId: true,
          requestedSeats: true,
          status: true,
          farePaisa: true,
          createdAt: true,
          updatedAt: true,
          pickupZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
        },
      });
    } catch (error) {
      this.fail("findByIdForPassenger", error, passengerId);
      throw error;
    }
  }

  async findFareNegotiationContext(rideRequestId: string) {
    try {
      return await prisma.rideRequest.findUnique({
        where: { id: rideRequestId },
        select: {
          id: true,
          status: true,
          passengerId: true,
          pool: {
            select: {
              vehicle: {
                select: {
                  driver: { select: { userId: true } },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      this.fail("findFareNegotiationContext", error);
      throw error;
    }
  }

  async acceptForDriver(
    rideRequestId: string,
    driverUserId: string,
    counterFarePaisa?: number,
  ) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.rideRequest.findFirst({
            where: {
              id: rideRequestId,
              status: "PENDING_DRIVER_ACCEPTANCE",
              pool: { vehicle: { driver: { userId: driverUserId } } },
            },
            select: {
              id: true,
              poolId: true,
              requestedSeats: true,
              status: true,
            },
          });

          if (!existing) return { kind: "not_found" as const };
          if (!existing.poolId) return { kind: "pool_not_found" as const };

          // Fetch pool and vehicle
          const pool = await transaction.ridePool.findUnique({
            where: { id: existing.poolId },
            select: {
              id: true,
              reservedSeats: true,
              vehicle: {
                select: {
                  capacity: true,
                },
              },
            },
          });

          if (!pool) return { kind: "pool_not_found" as const };
          if (!pool.vehicle) return { kind: "capacity_conflict" as const };
          if (
            pool.reservedSeats + existing.requestedSeats >
            pool.vehicle.capacity
          ) {
            return {
              kind: `capacity_conflict` as const,
            };
          }

          const updatedPool = await transaction.ridePool.update({
            where: { id: pool.id },
            data: { reservedSeats: { increment: existing.requestedSeats } },
            select: { id: true, reservedSeats: true },
          });

          const accepted = await transaction.rideRequest.update({
            where: { id: existing.id },
            data: {
              status: "MATCHED",
              ...(counterFarePaisa === undefined
                ? {}
                : { farePaisa: counterFarePaisa }),
            },
            include: {
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
              pool: {
                select: {
                  id: true,
                  status: true,
                  vehicle: { select: { id: true, name: true, capacity: true } },
                },
              },
            },
          });

          await transaction.rideStatusHistory.create({
            data: {
              requestId: existing.id,
              fromStatus: existing.status,
              toStatus: "MATCHED",
              changedById: driverUserId,
            },
          });

          return {
            kind: "accepted" as const,
            pool: updatedPool,
            request: accepted,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      this.fail("acceptForDriver", error, driverUserId);
      throw error;
    }
  }

  async findStatusHistoryForPassenger(
    rideRequestId: string,
    passengerId: string,
  ) {
    try {
      return await prisma.rideRequest.findFirst({
        where: { id: rideRequestId, passengerId },
        select: {
          id: true,
          status: true,
          statusHistory: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              fromStatus: true,
              toStatus: true,
              changedById: true,
              createdAt: true,
            },
          },
        },
      });
    } catch (error) {
      this.fail("findStatusHistoryForPassenger", error, passengerId);
      throw error;
    }
  }

  async cancelForPassenger(rideRequestId: string, passengerId: string) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const existing = await transaction.rideRequest.findFirst({
          where: { id: rideRequestId, passengerId },
          select: { id: true, status: true },
        });

        if (!existing) return { kind: "not_found" as const };

        const cancellableStatuses = new Set<string>([
          "REQUESTED",
          "PENDING_DRIVER_ACCEPTANCE",
          "MATCHED",
        ]);
        if (!cancellableStatuses.has(existing.status)) {
          return {
            kind: "invalid_status" as const,
            status: existing.status,
          };
        }

        const cancelled = await transaction.rideRequest.update({
          where: { id: existing.id },
          data: { status: "CANCELLED" },
          select: { id: true, status: true, updatedAt: true },
        });

        await transaction.rideStatusHistory.create({
          data: {
            requestId: existing.id,
            fromStatus: existing.status,
            toStatus: "CANCELLED",
            changedById: passengerId,
          },
        });

        return { kind: "cancelled" as const, request: cancelled };
      });
    } catch (error) {
      this.fail("cancelForPassenger", error, passengerId);
      throw error;
    }
  }

  async findPageByDriver(
    driverUserId: string,
    cursor: CursorPosition | undefined,
    limit: number,
  ) {
    try {
      const requests = await prisma.rideRequest.findMany({
        where: {
          pool: {
            vehicle: { driver: { userId: driverUserId } },
          },
          ...(cursor
            ? {
                OR: [
                  { createdAt: { gt: new Date(cursor.createdAt) } },
                  {
                    createdAt: new Date(cursor.createdAt),
                    id: { gt: cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        select: {
          id: true,
          passengerId: true,
          poolId: true,
          requestedSeats: true,
          status: true,
          farePaisa: true,
          createdAt: true,
          updatedAt: true,
          pickupZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          pool: {
            select: {
              id: true,
              status: true,
              vehicle: { select: { id: true, name: true, capacity: true } },
            },
          },
        },
      });

      return {
        items: requests.slice(0, limit),
        hasNextPage: requests.length > limit,
      };
    } catch (error) {
      this.fail("findPageByDriver", error, driverUserId);
      throw error;
    }
  }

  async findCompletedPageByDriver(
    driverUserId: string,
    page: number,
    limit: number,
  ) {
    try {
      const where = {
        status: "COMPLETED" as const,
        pool: { vehicle: { driver: { userId: driverUserId } } },
      };
      const [items, totalItems] = await prisma.$transaction([
        prisma.rideRequest.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            passengerId: true,
            poolId: true,
            requestedSeats: true,
            status: true,
            farePaisa: true,
            createdAt: true,
            updatedAt: true,
            pickupZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            destinationZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            pool: {
              select: {
                id: true,
                status: true,
                vehicle: { select: { id: true, name: true, capacity: true } },
              },
            },
          },
        }),
        prisma.rideRequest.count({ where }),
      ]);
      return { items, totalItems };
    } catch (error) {
      this.fail("findCompletedPageByDriver", error, driverUserId);
      throw error;
    }
  }

  async findCompletedPageByPassenger(
    passengerId: string,
    page: number,
    limit: number,
  ) {
    try {
      const where = { passengerId, status: "COMPLETED" as const };
      const [items, totalItems] = await prisma.$transaction([
        prisma.rideRequest.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            poolId: true,
            requestedSeats: true,
            status: true,
            farePaisa: true,
            createdAt: true,
            updatedAt: true,
            pickupZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            destinationZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            pool: {
              select: {
                id: true,
                status: true,
                vehicle: { select: { id: true, name: true, capacity: true } },
              },
            },
          },
        }),
        prisma.rideRequest.count({ where }),
      ]);
      return { items, totalItems };
    } catch (error) {
      this.fail("findCompletedPageByPassenger", error, passengerId);
      throw error;
    }
  }
}

export const rideRequestRepository = new RideRequestRepository();
