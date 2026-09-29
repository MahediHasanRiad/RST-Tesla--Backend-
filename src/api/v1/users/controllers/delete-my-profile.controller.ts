import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { userRepository } from "../user.repository.js";
import { deleteProfileSchema } from "../user.validation.js";

export async function deleteMyProfileController(
  request: Request,
  response: Response,
) {
  if (!request.user)
    throw new ApiError(401, "unauthenticated");

  const input = deleteProfileSchema.parse(request.body);
  const account = await userRepository.findForDeletion(request.user.id);
  if (
    !account ||
    !(await AuthCredentials.verifyPassword(
      account.password,
      input.currentPassword,
    ))
  )
    throw new ApiError(
      401,
      "invalid_credentials"
    );

  // delete user
  await userRepository.deleteInactiveAccount(request.user.id);
  

  return response.status(204).send();
}
