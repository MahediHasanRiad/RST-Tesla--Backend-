import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { rideRequestIdParamsSchema } from "../validation/ride-request.validation.js";
import { rideRequestRepository } from "../repository/ride-request.repository.js";


export async function getRideRequestController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") throw new ApiError(403, "forbidden");

  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const rideRequest = await rideRequestRepository.findByIdForPassenger(
    rideRequestId,
    request.user.id,
  );
  if (!rideRequest) throw new ApiError(404, "ride_request_not_found");

  return sendSuccess(response, 200, rideRequest);
}
