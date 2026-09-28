import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { env } from "../../../../config/env.js";
import { authRepository } from "../auth.repository.js";
import { verifyOtpSchema } from "../auth.validation.js";


async function verifyEmailHandler(req: Request, res: Response) {
  
  const { email, otp } = verifyOtpSchema.parse(req.body);

  if (!email || !otp) return;

  const challenge = await authRepository.consumeOtp({
    email: email,
    purpose: "EMAIL_VERIFICATION",
    otp: otp,
    now: new Date(),
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });

  if (!challenge) return res.status(401).send({ error: "invalid_otp" });
  await authRepository.verifyEmail(challenge.userId);

  return res.status(200).send({ verified: true });
}

export const verifyEmailController = asyncHandler(verifyEmailHandler);
