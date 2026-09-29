import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { authRepository } from "../auth.repository.js";
import { sendOtpMail } from "../../../../shared/auth/brevo.js";
import { resendVerificationSchema } from "../auth.validation.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";
import { env } from "../../../../config/env.js";

async function resendVerificationHandler(req: Request, res: Response) {
  const { email } = resendVerificationSchema.parse(req.body);

  const user = await authRepository.findUserByEmail(email);
  
  const otp = AuthCredentials.createOtp();
  
  // set in redis
  if (user && !user.isEmailVerified) {
    await redis.set(`auth:otp:${user.email}`, otp, "EX", env.OTP_TTL_SECONDS);

    try {
      // send email
      await sendOtpMail({
        email: email,
        otp,
        purpose: "EMAIL_VERIFICATION",
      });
    } catch (error) {
      logger.warn("Verification OTP email delivery failed", {
        requestId: req.requestId,
        actorId: user.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return res.status(202).send({ accepted: true });
}

export const resendVerificationController = asyncHandler(
  resendVerificationHandler,
);
