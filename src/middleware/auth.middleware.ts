import type { NextFunction, Request, Response } from "express";
import { authRepository } from "../api/v1/auth/auth.repository.js";
import { AuthCredentials } from "../shared/auth/credentials.js";

function getAccessTokenFromCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name !== "access-token" || valueParts.length === 0) continue;

    try {
      return decodeURIComponent(valueParts.join("="));
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authorization = request.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : getAccessTokenFromCookie(request);

  if (!accessToken)
    return response.status(401).json({ error: "unauthenticated" });
  try {
    const actor = await AuthCredentials.verifyAccessToken(accessToken);

    const user = await authRepository.findUserById(actor.userId);
    if (!user) return response.status(401).json({ error: "unauthenticated" });
    
    request.user = { id: user.id, email: user.email, role: user.role };
    next();
  } 
  catch {
    return response.status(401).json({ error: "unauthenticated" });
  }
}

export const authVerify = requireAuth;
