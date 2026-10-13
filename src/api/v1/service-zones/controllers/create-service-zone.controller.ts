import type { Request, Response } from "express";
import { Prisma } from "../../../../generated/prisma/client.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { serviceZoneRepository } from "../service-zone.repository.js";
import { createServiceZoneSchema } from "../service-zone.validation.js";

export async function createServiceZoneController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");

  const input = createServiceZoneSchema.parse(request.body);

  try {
    const zone = await serviceZoneRepository.create(input);

    return sendSuccess(response, 201, zone);
  } 
  catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(409, "service_zone_exists");

    throw error;
  }
}
