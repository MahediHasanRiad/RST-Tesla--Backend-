import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { rideRequestIdParamsSchema } from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";


export async function cancelRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") throw new ApiError(403, "forbidden");

  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const result = await rideRequestRepository.cancelForPassenger(
    rideRequestId,
    request.user.id,
  );

  if (result.kind === "not_found") {
    throw new ApiError(404, "ride_request_not_found");
  }
  if (result.kind === "invalid_status") {
    throw new ApiError(409, "ride_request_cannot_be_cancelled");
  }

  return sendSuccess(response, 200, result.request);
}
