import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { authRepository } from "../auth.repository.js";
import { changePasswordSchema } from "../auth.validation.js";

async function changePasswordHandler(req: Request, res: Response) {
  if (!req.actor) return res.status(401).send({ error: "unauthenticated" });
  const body = changePasswordSchema.parse(req.body);
  if (!body) return;
  const user = await authRepository.findUserById(req.actor.id);
  if (
    !user ||
    !(await AuthCredentials.verifyPassword(user.password, body.currentPassword))
  )
    return res.status(401).send("send");
  await authRepository.updatePasswordAndRevoke(
    user.id,
    await AuthCredentials.hashPassword(body.password),
  );
  return res.status(200).send({ passwordChanged: true });
}

export const changePasswordController = asyncHandler(changePasswordHandler);
