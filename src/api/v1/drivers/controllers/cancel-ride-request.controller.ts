import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { rideRequestIdParamsSchema } from "../../ride-requests/validation/ride-request.validation.js";
import { rideRequestRepository } from "../../ride-requests/repository/ride-request.repository.js";
import { emitRideStatusUpdate } from "../../../../realtime/ride-status.js";
import { logger } from "../../../../lib/logger.js";
import { persistAndQueuePushNotification } from "../../../../shared/notifications/push-notification.js";


export async function cancelRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER" && request.user.role !== "DRIVER")
    throw new ApiError(403, "forbidden");

  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const result = request.user.role === "DRIVER"
    ? await rideRequestRepository.cancelForDriver(rideRequestId, request.user.id)
    : await rideRequestRepository.cancelForPassenger(rideRequestId, request.user.id);

  if (result.kind === "not_found") {
    throw new ApiError(404, "ride_request_not_found");
  }
  if (result.kind === "invalid_status") {
    throw new ApiError(409, "ride_request_cannot_be_cancelled");
  }

  try {
    // send update using socket/io
    emitRideStatusUpdate(result.request.passengerId, {
      rideRequestId: result.request.id,
      status: "CANCELLED",
    });
  } catch (error) {
    logger.warn("Ride status realtime update failed after rejection", {
      rideRequestId: result.request.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  await persistAndQueuePushNotification({
    userId: request.user.role === "DRIVER"
      ? result.request.passengerId
      : ("driverUserId" in result ? result.driverUserId as string | null : null),
    eventType: "RIDE_CANCELLED",
    title: "Ride cancelled",
    body: "The ride request was cancelled.",
    data: { rideRequestId: result.request.id },
  });

  return sendSuccess(response, 200, result.request);
}
