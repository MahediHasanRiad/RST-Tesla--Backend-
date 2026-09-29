import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { authRepository } from "../auth.repository.js";
import { verifyOtpSchema } from "../auth.validation.js";
import { redis } from "../../../../lib/redis.js";


async function verifyEmailHandler(req: Request, res: Response) {
  
  const { email, otp } = verifyOtpSchema.parse(req.body);

  if (!email || !otp) return;

  // get from redis
  const storedOtp = await redis.get(`auth:otp:${email}`);
  
  if (!storedOtp || storedOtp !== otp)
    return res.status(401).send({ error: "invalid_otp" });

  const user = await authRepository.findUserByEmail(email);
  if (!user) return res.status(401).send({ error: "invalid_otp" });
  
  await redis.del(`auth:otp:${email}`);
  await authRepository.verifyEmail(user.id);

  return res.status(200).send({ verified: true });
}

export const verifyEmailController = asyncHandler(verifyEmailHandler);
