import type { Request, Response } from "express";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { authRepository } from "../auth.repository.js";

async function logoutHandler(
  request: Request,
  reply: Response,
) {
  if (!request.actor)
    return reply.status(401).send({ error: "unauthenticated" });
  await authRepository.revokeSession(request.actor.sessionId);
  return reply.status(200).send({ loggedOut: true });
}

export const logoutController = asyncHandler(logoutHandler);
