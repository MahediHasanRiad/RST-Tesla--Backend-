import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import {
  acceptFareSchema,
  rideRequestIdParamsSchema,
} from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";
import {
  emitRideNegotiationUpdate,
  emitRideStatusUpdate,
  emitRideStatusUpdateToUser,
} from "../../../../realtime/ride-status.js";
import { persistAndQueuePushNotification } from "../../../../shared/notifications/push-notification.js";
import { logger } from "../../../../lib/logger.js";

export async function acceptRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER" && request.user.role !== "DRIVER") {
    throw new ApiError(403, "forbidden");
  }

  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const { offerVersion } = acceptFareSchema.parse(request.body ?? {});
  let version = offerVersion;

  if (version === undefined) {
    if (request.user.role !== "DRIVER") {
      throw new ApiError(400, "offer_version_required");
    }
  }

  const result =
    request.user.role === "PASSENGER"
      ? await rideRequestRepository.acceptForPassenger(
          rideRequestId,
          request.user.id,
          version as number,
        )
      : await rideRequestRepository.acceptForDriver(
          rideRequestId,
          request.user.id,
          version,
        );

  if (result.kind === "not_found") throw new ApiError(404, "ride_request_not_found");
  if (result.kind === "forbidden") throw new ApiError(403, "forbidden");
  if (result.kind === "offer_not_found") throw new ApiError(409, "ride_offer_not_found");
  if (result.kind === "stale_offer") throw new ApiError(409, "ride_offer_stale");
  if (result.kind === "pool_not_found") throw new ApiError(404, "pool_not_found");
  if (result.kind === "capacity_conflict") {
    throw new ApiError(409, "ride_pool_capacity_conflict");
  }

  const negotiation = {
    rideRequestId,
    offerId: result.offer.id,
    offerVersion: result.offer.offerVersion,
    farePaisa: result.offer.amountPaisa,
    passengerAccepted: result.offer.passengerAcceptedAt !== null,
    driverAccepted: result.offer.driverAcceptedAt !== null,
  };

  if (result.matched) {
    try {
      emitRideStatusUpdate(result.passengerId, {
        rideRequestId,
        status: "MATCHED",
      });
      emitRideStatusUpdateToUser(result.driverUserId, {
        rideRequestId,
        status: "MATCHED",
      });
    } catch {
      logger.warn('confilct during ride request')
    }
    await persistAndQueuePushNotification({
      userId: result.passengerId,
      eventType: "RIDE_MATCHED",
      title: "Ride accepted",
      body: "Both passenger and driver accepted the negotiated fare.",
      data: { rideRequestId, offerVersion: String(result.offer.offerVersion) },
    });
  } else {
    const otherUserId =
      request.user.role === "PASSENGER" ? result.driverUserId : result.passengerId;
    try {
      emitRideNegotiationUpdate(otherUserId, negotiation);
    } catch {
      logger.warn('confilct during ride request')
    }
    await persistAndQueuePushNotification({
      userId: otherUserId,
      eventType: "RIDE_FARE_ACCEPTED",
      title: "Fare accepted",
      body: "The other participant accepted the current fare offer.",
      data: { rideRequestId, offerVersion: String(result.offer.offerVersion) },
    });
  }

  return sendSuccess(response, 200, {
    request: result.request,
    offer: result.offer,
    ...negotiation,
    matched: result.matched,
  });
}
