import { logger } from "../../../../lib/logger.js";
import { prisma } from "../../../../lib/prisma.js";
import { Prisma } from "../../../../generated/prisma/client.js";
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
          fareOffers: {
            create: {
              offerVersion: 1,
              amountPaisa: farePaisa,
              proposedById: passengerId,
            },
          },
        },
        include: {
          pickupServiceZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationServiceZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
        },
      });
    } catch (error) {
      this.fail("create", error, passengerId);
      throw error;
    }
  }

  async findDriverUserIdByPoolId(poolId: string | undefined) {
    if (!poolId) return null;
    try {
      const pool = await prisma.ridePool.findUnique({
        where: { id: poolId },
        select: {
          vehicle: { select: { driver: { select: { userId: true } } } },
        },
      });
      return pool?.vehicle.driver.userId ?? null;
    } catch (error) {
      this.fail("findDriverUserIdByPoolId", error);
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
              status: "PENDING_DRIVER_ACCEPTANCE",
              farePaisa,
              fareOffers: {
                create: {
                  offerVersion: 1,
                  amountPaisa: farePaisa,
                  proposedById: passengerId,
                },
              },
            },
            include: {
              pickupServiceZone: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
              destinationServiceZone: {
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
          fareOffers: {
            where: { status: "CURRENT" },
            orderBy: { offerVersion: "desc" },
            take: 1,
            select: {
              id: true,
              offerVersion: true,
              amountPaisa: true,
              proposedById: true,
              passengerAcceptedAt: true,
              driverAcceptedAt: true,
            },
          },
          createdAt: true,
          updatedAt: true,
          pickupServiceZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationServiceZone: {
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
          fareOffers: {
            where: { status: "CURRENT" },
            orderBy: { offerVersion: "desc" },
            take: 1,
            select: {
              id: true,
              offerVersion: true,
              amountPaisa: true,
              proposedById: true,
              passengerAcceptedAt: true,
              driverAcceptedAt: true,
            },
          },
          createdAt: true,
          updatedAt: true,
          pickupServiceZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationServiceZone: {
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
          ridePool: {
            select: {
              vehicle: {
                select: {
                  driver: { select: { userId: true } },
                },
              },
            },
          },
          fareOffers: {
            where: { status: "CURRENT" },
            orderBy: { offerVersion: "desc" },
            take: 1,
            select: {
              id: true,
              offerVersion: true,
              amountPaisa: true,
              proposedById: true,
              passengerAcceptedAt: true,
              driverAcceptedAt: true,
            },
          },
        },
      });
    } catch (error) {
      this.fail("findFareNegotiationContext", error);
      throw error;
    }
  }

  async counterFare(
    rideRequestId: string,
    passengerId: string,
    amountPaisa: number,
  ) {
    try {
      if (!Number.isSafeInteger(amountPaisa) || amountPaisa <= 0) {
        return { kind: "invalid_amount" as const };
      }

      return await prisma.$transaction(async (tx) => {
        const existing = await tx.rideRequest.findUnique({
          where: {
            id: rideRequestId,
          },
          select: {
            id: true,
            status: true,
            passengerId: true,
            ridePool: {
              select: {
                vehicle: {
                  select: {
                    driver: {
                      select: {
                        userId: true,
                      },
                    },
                  },
                },
              },
            },
            fareOffers: {
              where: {
                status: "CURRENT",
              },
              orderBy: {
                offerVersion: "desc",
              },
              take: 1,
              select: {
                id: true,
                offerVersion: true,
                proposedById: true,
              },
            },
          },
        });

        if (!existing) {
          return { kind: "not_found" as const };
        }

        if (
          !["REQUESTED", "PENDING_DRIVER_ACCEPTANCE"].includes(existing.status)
        ) {
          return { kind: "invalid_status" as const };
        }

        const driverUserId = existing.ridePool?.vehicle.driver.userId;

        if (
          existing.passengerId !== passengerId &&
          driverUserId !== passengerId
        ) {
          return { kind: "forbidden" as const };
        }

        const currentOffer = existing.fareOffers[0];

        // Prevent a user from countering their own offer.
        if (currentOffer?.proposedById === passengerId) {
          return { kind: "own_offer" as const };
        }

        const nextVersion = (currentOffer?.offerVersion ?? 0) + 1;

        // Conditional write protects against concurrent changes
        const claim = await tx.rideRequest.updateMany({
          where: {
            id: existing.id,
            status: {
              in: ["REQUESTED", "PENDING_DRIVER_ACCEPTANCE"],
            },
          },
          data: {
            updatedAt: new Date(),
          },
        });

        if (claim.count !== 1) {
          return { kind: "conflict" as const };
        }

        if (currentOffer) {
          const replaced = await tx.rideFareOffer.updateMany({
            where: {
              id: currentOffer.id,
              status: "CURRENT",
            },
            data: {
              status: "REPLACED",
            },
          });

          if (replaced.count !== 1) {
            return { kind: "conflict" as const };
          }
        }

        const offer = await tx.rideFareOffer.create({
          data: {
            rideRequestId: existing.id,
            offerVersion: nextVersion,
            amountPaisa,
            proposedById: passengerId,
            status: "CURRENT",
          },
          select: {
            id: true,
            offerVersion: true,
            amountPaisa: true,
            proposedById: true,
            passengerAcceptedAt: true,
            driverAcceptedAt: true,
          },
        });

        return {
          kind: "countered" as const,
          requestId: existing.id,
          status: existing.status,
          offer,
          passengerId: existing.passengerId,
          driverUserId,
        };
      });
    } catch (error) {
      this.fail("counterFare", error, passengerId);
      throw error;
    }
  }

  async acceptForActor(
    rideRequestId: string,
    actorId: string,
    role: "PASSENGER" | "DRIVER",
    offerVersion: number | undefined,
  ) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const existing = await transaction.rideRequest.findFirst({
          where: {
            id: rideRequestId,
            status: { in: ["REQUESTED", "PENDING_DRIVER_ACCEPTANCE"] },
          },
          select: {
            id: true,
            passengerId: true,
            poolId: true,
            requestedSeats: true,
            status: true,
            fareOffers: {
              where: { status: "CURRENT" },
              orderBy: { offerVersion: "desc" },
              take: 1,
              select: {
                id: true,
                offerVersion: true,
                amountPaisa: true,
                proposedById: true,
                passengerAcceptedAt: true,
                driverAcceptedAt: true,
              },
            },
            ridePool: {
              select: {
                id: true,
                reservedSeats: true,
                vehicle: {
                  select: {
                    id: true,
                    capacity: true,
                    driver: { select: { userId: true } },
                  },
                },
              },
            },
          },
        });

        if (!existing) return { kind: "not_found" as const };

        const driverUserId = existing.ridePool?.vehicle.driver.userId;
        const authorized =
          (role === "PASSENGER" && existing.passengerId === actorId) ||
          (role === "DRIVER" && driverUserId === actorId);
        if (!authorized) return { kind: "forbidden" as const };

        const currentOffer = existing.fareOffers[0];
        if (!currentOffer) return { kind: "offer_not_found" as const };

        if (
          offerVersion !== undefined &&
          currentOffer.offerVersion !== offerVersion
        ) {
          return { kind: "stale_offer" as const, offer: currentOffer };
        }

        const otherAlreadyAccepted =
          role === "PASSENGER"
            ? currentOffer.driverAcceptedAt !== null
            : currentOffer.passengerAcceptedAt !== null;

        if (otherAlreadyAccepted && existing.ridePool) {
          const pool = existing.ridePool;
          const projectedSeats = pool.reservedSeats + existing.requestedSeats;

          if (projectedSeats > pool.vehicle.capacity) {
            return { kind: "capacity_conflict" as const };
          }
        }

        const now = new Date();

        const updateResult = await transaction.rideFareOffer.updateMany({
          where: {
            id: currentOffer.id,
            offerVersion: currentOffer.offerVersion,
          },
          data:
            role === "PASSENGER"
              ? { passengerAcceptedAt: now }
              : { driverAcceptedAt: now },
        });

        if (updateResult.count === 0) {
          return { kind: "stale_offer" as const, offer: currentOffer };
        }

        const updatedOffer = await transaction.rideFareOffer.findUniqueOrThrow({
          where: { id: currentOffer.id },
          select: {
            id: true,
            offerVersion: true,
            amountPaisa: true,
            proposedById: true,
            passengerAcceptedAt: true,
            driverAcceptedAt: true,
          },
        });

        const matched =
          updatedOffer.passengerAcceptedAt !== null &&
          updatedOffer.driverAcceptedAt !== null;

        if (matched && existing.poolId) {
          await transaction.ridePool.update({
            where: { id: existing.poolId },
            data: {
              reservedSeats: {
                increment: existing.requestedSeats,
              },
            },
          });
        }

        const request = await transaction.rideRequest.update({
          where: { id: existing.id },
          data: matched
            ? {
                status: "MATCHED",
                farePaisa: updatedOffer.amountPaisa,
                matchedAt: now,
              }
            : {},
          include: {
            pickupServiceZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            destinationServiceZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            ridePool: {
              select: {
                id: true,
                status: true,
                reservedSeats: true,
                vehicle: { select: { id: true, name: true, capacity: true } },
              },
            },
          },
        });

        if (matched) {
          await transaction.rideStatusHistory.create({
            data: {
              requestId: existing.id,
              fromStatus: existing.status,
              toStatus: "MATCHED",
              changedById: actorId,
            },
          });
        }

        return {
          kind: "accepted" as const,
          matched,
          request,
          offer: updatedOffer,
          passengerId: existing.passengerId,
          driverUserId,
          pool: existing.ridePool,
        };
      });
    } catch (error) {
      this.fail("acceptForActor", error, actorId);
      throw error;
    }
  }

  async acceptForDriver(
    rideRequestId: string,
    driverUserId: string,
    offerVersion?: number,
  ) {
    return this.acceptForActor(
      rideRequestId,
      driverUserId,
      "DRIVER",
      offerVersion,
    );
  }

  async acceptForPassenger(
    rideRequestId: string,
    passengerId: string,
    offerVersion: number,
  ) {
    return this.acceptForActor(
      rideRequestId,
      passengerId,
      "PASSENGER",
      offerVersion,
    );
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
          rideStatusHistories: {
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
          select: {
            id: true,
            passengerId: true,
            status: true,
            updatedAt: true,
            ridePool: {
              select: {
                vehicle: { select: { driver: { select: { userId: true } } } },
              },
            },
          },
        });

        await transaction.rideStatusHistory.create({
          data: {
            requestId: existing.id,
            fromStatus: existing.status,
            toStatus: "CANCELLED",
            changedById: passengerId,
          },
        });

        return {
          kind: "cancelled" as const,
          request: cancelled,
          driverUserId: cancelled.ridePool?.vehicle.driver.userId ?? null,
        };
      });
    } catch (error) {
      this.fail("cancelForPassenger", error, passengerId);
      throw error;
    }
  }

  async cancelForDriver(rideRequestId: string, driverUserId: string) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const existing = await transaction.rideRequest.findFirst({
          where: {
            id: rideRequestId,
            status: "PENDING_DRIVER_ACCEPTANCE",
            ridePool: { vehicle: { driver: { userId: driverUserId } } },
          },
          select: { id: true, passengerId: true, status: true },
        });

        if (!existing) return { kind: "not_found" as const };

        const cancelled = await transaction.rideRequest.update({
          where: { id: existing.id },
          data: { status: "CANCELLED" },
          select: {
            id: true,
            passengerId: true,
            status: true,
            updatedAt: true,
          },
        });

        await transaction.rideStatusHistory.create({
          data: {
            requestId: existing.id,
            fromStatus: existing.status,
            toStatus: "CANCELLED",
            changedById: driverUserId,
          },
        });

        return { kind: "cancelled" as const, request: cancelled };
      });
    } catch (error) {
      this.fail("cancelForDriver", error, driverUserId);
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
          ridePool: {
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
          fareOffers: {
            where: { status: "CURRENT" },
            orderBy: { offerVersion: "desc" },
            take: 1,
            select: {
              id: true,
              offerVersion: true,
              amountPaisa: true,
              proposedById: true,
              passengerAcceptedAt: true,
              driverAcceptedAt: true,
            },
          },
          createdAt: true,
          updatedAt: true,
          pickupServiceZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          destinationServiceZone: {
            select: { id: true, name: true, latitude: true, longitude: true },
          },
          ridePool: {
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
        ridePool: { vehicle: { driver: { userId: driverUserId } } },
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
            pickupServiceZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            destinationServiceZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            ridePool: {
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
            pickupServiceZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            destinationServiceZone: {
              select: { id: true, name: true, latitude: true, longitude: true },
            },
            ridePool: {
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
