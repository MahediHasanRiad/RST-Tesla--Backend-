import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { logger } from "../../../../lib/logger.js";
import { sendOtpMail } from "../../../../shared/auth/brevo.js";
import { authRepository } from "../auth.repository.js";
import { registerSchema } from "../auth.validation.js";
import {
  deleteUploadedAvatar,
  uploadAvatar,
} from "../../../../shared/media/avatar.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { redis } from "../../../../lib/redis.js";
import { env } from "../../../../config/env.js";

async function registerHandler(req: Request, res: Response) {
  
  const registration = registerSchema.parse({
    ...req.body,
    avatar: req.file
      ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
      : undefined,
  });

  const { name, email, password, phone, role, avatar } = registration;

  let uploadedAvatar: { url: string; publicId: string } | undefined;
  
  try {
    if (await authRepository.findUserByEmail(email))
      return res.status(409).send({ error: "account_conflict" });

    // avatar upload in cloudinary
    if (avatar)
      uploadedAvatar = await uploadAvatar(avatar.buffer, avatar.mimetype);


    // create user
    const otp = AuthCredentials.createOtp();
    const result = await authRepository.createUser({
      name,
      email,
      phone,
      role,
      avatar: uploadedAvatar?.url,
      avatarPublicId: uploadedAvatar?.publicId,
      password: await AuthCredentials.hashPassword(password),
    });

    // send in redis
    await redis.set(`auth:otp:${email}`, otp, "EX", env.OTP_TTL_SECONDS);

    try {
      // send email
      await sendOtpMail({
        email: email,
        otp,
        purpose: "EMAIL_VERIFICATION",
      });
    } catch (error) {
      logger.warn("Registration OTP email delivery failed", {
        requestId: req.requestId,
        actorId: result.user.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    // response
    return sendSuccess(res, 201, 'send otp')
  } catch (error) {
    if (uploadedAvatar)
      await deleteUploadedAvatar(uploadedAvatar.publicId).catch(
        (cleanupError) =>
          logger.warn("Registration avatar cleanup failed", {
            requestId: req.requestId,
            error: cleanupError,
          }),
      );
    if (error instanceof ApiError) throw error;
    logger.error("Registration failed", {
      requestId: req.requestId,
      error,
    });
    return res.status(500).send({ error: "internal_error" });
  }
}

export const registerController = asyncHandler(registerHandler);
