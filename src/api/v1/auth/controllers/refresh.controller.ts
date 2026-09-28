import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { env } from "../../../../config/env.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { authRepository } from "../auth.repository.js";
import { refreshSchema } from "../auth.validation.js";


async function refreshHandler(
  req: Request,
  res: Response,
) {
  const body = refreshSchema.parse(req.body);
  if (!body) return;
  const refreshToken = AuthCredentials.createRefreshToken();
  const rotated = await authRepository.rotateSession(
    AuthCredentials.hashOpaque(body.refreshToken),
    AuthCredentials.hashOpaque(refreshToken),
    new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000),
  );
  if (!rotated || !rotated.user.isEmailVerified)
    return res.status(401).send({ error: "invalid_refresh" });
  return res.status(200).send({
    accessToken: await AuthCredentials.signAccessToken({
      id: rotated.user.id,
      role: rotated.user.role,
      sessionId: rotated.session.id,
    }),
    refreshToken,
    role: rotated.user.role,
  });
}

export const refreshController = asyncHandler(refreshHandler);
