import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { authRepository } from "../auth.repository.js";
import { resetPasswordSchema } from "../auth.validation.js";
import { redis } from "../../../../lib/redis.js";


async function resetPasswordHandler(
  req: Request,
  res: Response,
) {
  const body = resetPasswordSchema.parse(req.body);
  if (!body) return;
  const storedOtp = await redis.get(`auth:otp:${body.email}`);
  if (!storedOtp || storedOtp !== body.otp)
    return res.status(401).send({ error: "invalid_otp" });
  const user = await authRepository.findUserByEmail(body.email);
  if (!user) return res.status(401).send({ error: "invalid_otp" });
  await redis.del(`auth:otp:${body.email}`);
  await authRepository.updatePasswordAndRevoke(
    user.id,
    await AuthCredentials.hashPassword(body.password),
  );
  return res.status(200).send({ passwordReset: true });
}

export const resetPasswordController = asyncHandler(resetPasswordHandler);
