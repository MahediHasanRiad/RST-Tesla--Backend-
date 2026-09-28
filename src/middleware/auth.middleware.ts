import type { NextFunction, Request, Response } from "express";
import { AuthCredentials } from "../shared/auth/credentials.js";
import { authRepository } from "../api/v1/auth/auth.repository.js";
import type { AuthActor } from "../api/v1/auth/auth.model.js";

export async function requireAuth(
  request: Request,
  reply: Response,
  next: NextFunction,
) {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer "))
    return reply.status(401).json({ error: "unauthenticated" });
  try {
    const actor = await AuthCredentials.verifyAccessToken(value.slice(7));
    if (!(await authRepository.isSessionActive(actor.sessionId)))
      return reply.status(401).json({ error: "unauthenticated" });
    request.actor = actor;
    next();
  } catch {
    return reply.status(401).json({ error: "unauthenticated" });
  }
}
