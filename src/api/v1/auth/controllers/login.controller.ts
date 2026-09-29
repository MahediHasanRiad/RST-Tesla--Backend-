import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { env } from "../../../../config/env.js";
import { AuthCredentials } from "../../../../shared/auth/credentials.js";
import { authRepository } from "../auth.repository.js";
import { loginSchema } from "../auth.validation.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";

function toPublicUser(user: NonNullable<Awaited<ReturnType<typeof authRepository.findUserByEmail>>>) {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

async function loginHandler(
  req: Request,
  res: Response,
) {
  const body = loginSchema.parse(req.body)

  if (!body) return;

  const user = await authRepository.findUserByEmail(body.email);

  const now = new Date();
  const passwordMatches = user
    ? await AuthCredentials.verifyPassword(user.password, body.password)
    : false;

  if (
    !user ||
    !user.isEmailVerified ||
    (user.lockedUntil && user.lockedUntil > now) ||
    !passwordMatches
  ) {
    if (user && (!user.lockedUntil || user.lockedUntil <= now)) {
      const lock =
        user.failedLoginAttempts + 1 >= env.LOGIN_MAX_FAILURES
          ? new Date(Date.now() + env.LOGIN_LOCKOUT_SECONDS * 1000)
          : null;
      await authRepository.recordLoginFailure(user.id, lock);
    }
    return res
      .status(user?.lockedUntil && user.lockedUntil > now ? 429 : 401)
      .send({ error: "invalid_credentials" });
  }

  // set in cookie
  const accessToken = await AuthCredentials.signAccessToken({
    userId: user.id,
    role: user.role,
  });
  const refreshToken = await AuthCredentials.signRefreshToken({
    userId: user.id,
    role: user.role,
  });

  res.cookie('access-token', accessToken)
  res.cookie('refresh-token', refreshToken)
  
  return sendSuccess(res, 200, toPublicUser(user));
}

export const loginController = asyncHandler(loginHandler);
