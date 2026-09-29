import type { Request, Response } from "express";
import { authRepository } from "../auth.repository.js";
import { forgotPasswordSchema } from "../auth.validation.js";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { sendOtpMail } from "../../../../shared/auth/brevo.js";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { env } from "../../../../config/env.js";

async function forgotPasswordHandler(
  req: Request,
  res: Response,
) {
  const body = forgotPasswordSchema.parse(req.body);
  if (!body) return;
  const user = await authRepository.findUserByEmail(body.email);
  if (user?.isEmailVerified) {
    const otp = AuthCredentials.createOtp();
    await redis.set(`auth:otp:${user.email}`, otp, "EX", env.OTP_TTL_SECONDS);
    try {
      await sendOtpMail({
        email: user.email,
        otp,
        purpose: "PASSWORD_RESET",
      });
    } catch (error) {
      logger.warn("Password-reset OTP email delivery failed", {
        requestId: req.requestId,
        actorId: user.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res.status(202).send({ accepted: true });
}

export const forgotPasswordController = asyncHandler(forgotPasswordHandler);
