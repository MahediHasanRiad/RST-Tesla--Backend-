import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { env } from "../../../../config/env.js";
import { authRepository } from "../auth.repository.js";
import { sendOtpMail } from "../../../../shared/auth/brevo.js";
import { resendVerificationSchema } from "../auth.validation.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { logger } from "../../../../lib/logger.js";
import { redis } from "../../../../lib/redis.js";

async function resendVerificationHandler(req: Request, res: Response) {
  const { email } = resendVerificationSchema.parse(req.body);

  const user = await authRepository.findUserByEmail(email);
  
  const otp = AuthCredentials.createOtp();
  
  if (user && !user.isEmailVerified) {
    await authRepository.createOtpChallenge({
      userId: user.id,
      email: user.email,
      purpose: "EMAIL_VERIFICATION",
      otpHash: otp,
      expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000),
    });

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
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    // set in cache
    await redis.set(`auth:otp:email-verification:${user?.id}`, otp, "EX", 300);
  } catch (error) {
    logger.warn("Registration OTP Redis cache write failed", {
      requestId: req.requestId,
      challengeId: user?.id,
      error,
    });
  }

  return res.status(202).send({ accepted: true });
}

export const resendVerificationController = asyncHandler(
  resendVerificationHandler,
);
