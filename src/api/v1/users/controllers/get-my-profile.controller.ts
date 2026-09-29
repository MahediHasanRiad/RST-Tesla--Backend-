import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { userRepository } from "../user.repository.js";

export async function getMyProfileController(
  request: Request,
  response: Response,
) {
  
  const userId = request.user?.id as string
  console.log('user', userId)
  if (!userId)
    throw new ApiError(401, "unauthenticated !!");

  const profile = await userRepository.findSafeProfile(userId);
  
  if (!profile) throw new ApiError(404, "user_not_found");
  
  return sendSuccess(response, 200, profile);
}
