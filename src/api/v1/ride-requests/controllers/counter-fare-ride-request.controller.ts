import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import {
  counterFareSchema,
  rideRequestIdParamsSchema,
} from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";
import { persistAndQueuePushNotification } from "../../../../shared/notifications/push-notification.js";

export async function counterFareRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER" && request.user.role !== "DRIVER") {
    throw new ApiError(403, "forbidden");
  }

  // input validation
  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const { farePaisa } = counterFareSchema.parse(request.body);

  // find ride request
  const context =
    await rideRequestRepository.findFareNegotiationContext(rideRequestId);

  if (!context) throw new ApiError(404, "ride_request_not_found");
  if (
    context.status !== "REQUESTED" &&
    context.status !== "PENDING_DRIVER_ACCEPTANCE"
  ) {
    throw new ApiError(409, "ride_request_cannot_counter_fare");
  }

  // check the requested user and counter-fare user same or not
  const isPassenger = context.passengerId === request.user.id;
  const isDriver = context.ridePool?.vehicle?.driver.userId === request.user.id;
  if (!isPassenger && !isDriver) throw new ApiError(403, "forbidden");

  // create
  const result = await rideRequestRepository.counterFare(
    rideRequestId,
    request.user.id,
    farePaisa,
  );
  if (result.kind === "not_found")
    throw new ApiError(404, "ride_request_not_found");
  if (result.kind === "forbidden") throw new ApiError(403, "forbidden");

  // ensure result contains an offer
  if (!("offer" in result)) {
    throw new ApiError(500, "unexpected_result_shape");
  }

  const acceptance = {
    passengerAccepted: false,
    driverAccepted: false,
  };

  // ensure result has expected fields for notification
  if (isPassenger && !("driverUserId" in result)) {
    throw new ApiError(500, "unexpected_result_shape");
  }
  if (!isPassenger && !("passengerId" in result)) {
    throw new ApiError(500, "unexpected_result_shape");
  }

  // send notificatoin
  await persistAndQueuePushNotification({
    userId: isPassenger
      ? (result as { driverUserId: string }).driverUserId
      : (result as { passengerId: string }).passengerId,
    eventType: "COUNTER_FARE_UPDATED",
    title: "Counter fare updated",
    body: `A counter fare of ${farePaisa} paisa was submitted.`,
    data: {
      rideRequestId,
      farePaisa: String(farePaisa),
      offerVersion: String(
        (result as { offer: { offerVersion: number | string } }).offer
          .offerVersion,
      ),
    },
  });

  // response
  return sendSuccess(response, 200, {
    rideRequestId,
    offer: result.offer,
    ...acceptance,
    status: result.status,
    persisted: true,
  });
}
