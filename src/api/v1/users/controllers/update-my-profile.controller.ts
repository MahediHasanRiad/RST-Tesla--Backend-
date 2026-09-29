import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { logger } from "../../../../lib/logger.js";
import {
  deleteUploadedAvatar,
  uploadAvatar,
} from "../../../../shared/media/avatar.js";
import { userRepository } from "../user.repository.js";
import { updateProfileSchema } from "../user.validation.js";

export async function updateMyProfileController(
  request: Request,
  response: Response,
) {
  if (!request?.user) throw new ApiError(401, "unauthenticated");
  
  // validate input
  const input = updateProfileSchema.parse({
    ...request.body,
    avatar: request.file
      ? { buffer: request.file.buffer, mimetype: request.file.mimetype }
      : undefined,
  });
  // check phone unique or not
  if (
    input.phone &&
    (await userRepository.phoneBelongsToAnother(input.phone, request.user.id))
  )
    throw new ApiError(409, "phone_conflict");
  const existing = await userRepository.findForDeletion(request.user.id);
  if (!existing) throw new ApiError(404, "user_not_found");
  
  let replacement: { url: string; publicId: string } | undefined;
  
  try {
    if (input.avatar)
      replacement = await uploadAvatar(
        input.avatar.buffer,
        input.avatar.mimetype,
      );
    const profile = await userRepository.updateProfile(
      request.user.id,
      input,
      replacement,
    );

    if (replacement && existing.avatarPublicId)
      await deleteUploadedAvatar(existing.avatarPublicId).catch((error) =>
        logger.warn("Previous avatar cleanup failed", {
          requestId: request.requestId,
          actorId: request.user?.id,
          avatarPublicId: existing.avatarPublicId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    const { avatarPublicId: _avatarPublicId, ...safeProfile } = profile;
    return sendSuccess(response, 200, safeProfile);
  } 
  catch (error) {
    const replacementPublicId = replacement?.publicId;
    if (replacementPublicId)
      await deleteUploadedAvatar(replacementPublicId).catch((cleanupError) =>
        logger.warn("Replacement avatar cleanup failed", {
          requestId: request.requestId,
          actorId: request.user?.id,
          avatarPublicId: replacementPublicId,
          errorName:
            cleanupError instanceof Error ? cleanupError.name : "UnknownError",
        }),
      );
    throw error;
  }
}
