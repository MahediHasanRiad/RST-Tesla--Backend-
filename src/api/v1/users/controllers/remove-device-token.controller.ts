import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { deviceTokenRepository } from "../device-token.repository.js";
import { removeDeviceTokenSchema } from "../device-token.validation.js";

export async function removeDeviceTokenController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated");
  const { token } = removeDeviceTokenSchema.parse(request.body);
  await deviceTokenRepository.remove(request.user.id, token);
  return sendSuccess(response, 200, { removed: true });
}
