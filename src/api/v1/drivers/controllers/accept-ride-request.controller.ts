import type { Request, Response } from "express";
import { acceptRideRequestController as acceptNegotiatedRideRequestController } from "../../ride-requests/controllers/accept-ride-request.controller.js";

export async function acceptRideRequestController(
  request: Request,
  response: Response,
) {
  return acceptNegotiatedRideRequestController(request, response);
}
