import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { env } from "../../../../config/env.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { authRepository } from "../auth.repository.js";
import { resetPasswordSchema } from "../auth.validation.js";


async function resetPasswordHandler(
  req: Request,
  res: Response,
) {
  const body = resetPasswordSchema.parse(req.body);
  if (!body) return;
  const challenge = await authRepository.consumeOtp({
    email: body.email,
    purpose: "PASSWORD_RESET",
    otp: body.otp,
    now: new Date(),
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });
  if (!challenge) return res.status(401).send({ error: "invalid_otp" });
  await authRepository.updatePasswordAndRevoke(
    challenge.userId,
    await AuthCredentials.hashPassword(body.password),
  );
  return res.status(200).send({ passwordReset: true });
}

export const resetPasswordController = asyncHandler(resetPasswordHandler);
