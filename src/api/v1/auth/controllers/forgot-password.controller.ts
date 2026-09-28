import type { Request, Response } from "express";
import { authRepository } from "../auth.repository.js";
import { forgotPasswordSchema } from "../auth.validation.js";
import { asyncHandler } from "../../../../shared/http/async-handler.js";

async function forgotPasswordHandler(
  req: Request,
  res: Response,
) {
  const body = forgotPasswordSchema.parse(req.body);
  if (!body) return;
  const user = await authRepository.findUserByEmail(body.email);
  if (user?.isEmailVerified)

  return res.status(202).send({ accepted: true });
}

export const forgotPasswordController = asyncHandler(forgotPasswordHandler);
