import argon2 from "argon2";
import bcrypt from "bcrypt";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

const BCRYPT_COST_FACTOR = 12;

export class AuthCredentials {
  static async hashPassword(value: string) {
    return bcrypt.hash(value, BCRYPT_COST_FACTOR);
  }

  static needsPasswordRehash(hash: string) {
    return hash.startsWith("$argon2");
  }

  static async verifyPassword(hash: string, value: string) {
    return AuthCredentials.needsPasswordRehash(hash)
      ? argon2.verify(hash, value)
      : bcrypt.compare(value, hash);
  }
  static createOtp() {
    return randomBytes(4).readUInt32BE(0).toString().padStart(6, "0").slice(-6);
  }

  static hashOpaque(value: string) {
    return createHash("sha256").update(value).digest("base64url");
  }

  static createRefreshToken() {
    return randomBytes(48).toString("base64url");
  }

  static async signAccessToken(actor: {
    id: string;
    role: string;
    sessionId: string;
  }) {
    return new SignJWT({
      role: actor.role,
      sessionId: actor.sessionId,
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(actor.id)
      .setIssuer(env.JWT_ISSUER)
      .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(secret);
  }
  
  static async verifyAccessToken(token: string) {
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.JWT_ISSUER,
    });
    if (
      payload.type !== "access" ||
      !payload.sub ||
      typeof payload.role !== "string" ||
      typeof payload.sessionId !== "string"
    )
      throw new Error("Invalid access token");
    return {
      id: payload.sub,
      role: payload.role as "PASSENGER" | "DRIVER" | "ADMIN",
      sessionId: payload.sessionId,
    };
  }
}
