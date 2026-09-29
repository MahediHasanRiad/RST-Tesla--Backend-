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

  static async signRefreshToken(actor: {
    userId: string;
    role: string;
  }) {
    return new SignJWT({
      role: actor.role,
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(actor.userId)
      .setIssuer(env.JWT_ISSUER)
      .setExpirationTime(env.REFRESH_TOKEN_TTL_SECONDS)
      .sign(secret);
  }
  
  static async signAccessToken(actor: {
    userId: string;
    role: string;
  }) {
    return new SignJWT({
      role: actor.role,
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(actor.userId)
      .setIssuer(env.JWT_ISSUER)
      .setExpirationTime(env.ACCESS_TOKEN_TTL_SECONDS)
      .sign(secret);
  }
  
  static async verifyAccessToken(token: string) {
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.JWT_ISSUER,
    });
    if (
      payload.type !== "access" ||
      !payload.sub ||
      typeof payload.role !== "string"
    )
      throw new Error("Invalid access token");
    return {
      userId: payload.sub,
      role: payload.role as "PASSENGER" | "DRIVER" | "ADMIN",
    };
  }
}
