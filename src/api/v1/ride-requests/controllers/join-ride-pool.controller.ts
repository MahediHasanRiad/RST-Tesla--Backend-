import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { joinRidePoolSchema } from "../validation/ride-pool.validation.js";
import { rideRequestIdParamsSchema } from "../validation/ride-request.validation.js";
import { ridePoolRepository } from "../repository/ride-pool.repository.js";

export async function joinRidePoolController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "PASSENGER") throw new ApiError(403, "forbidden");

  const { rideRequestId } = rideRequestIdParamsSchema.parse(request.params);
  const { poolId } = joinRidePoolSchema.parse(request.body);
  const result = await ridePoolRepository.joinForPassenger(
    request.user.id,
    rideRequestId,
    poolId,
  );

  if (result.kind === "request_not_found") {
    throw new ApiError(404, "ride_request_not_found");
  }
  if (result.kind === "request_not_joinable") {
    throw new ApiError(409, "ride_request_not_joinable");
  }
  if (result.kind === "pool_not_found") {
    throw new ApiError(404, "ride_pool_not_found");
  }
  if (result.kind === "pool_closed") {
    throw new ApiError(409, "ride_pool_not_open");
  }
  if (result.kind === "route_mismatch") {
    throw new ApiError(409, "ride_pool_route_mismatch");
  }
  if (result.kind === "capacity_conflict") {
    throw new ApiError(409, "ride_pool_capacity_conflict");
  }

  return sendSuccess(response, 200, result);
}
