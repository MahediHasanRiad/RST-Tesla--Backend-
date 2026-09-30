import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { deviceTokenRepository } from "../device-token.repository.js";
import { deviceTokenSchema } from "../device-token.validation.js";

export async function registerDeviceTokenController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  const input = deviceTokenSchema.parse(request.body);
  
  const token = await deviceTokenRepository.upsert(
    request.user.id,
    input.token,
    input.platform,
  );
  return sendSuccess(response, 200, token);
}
