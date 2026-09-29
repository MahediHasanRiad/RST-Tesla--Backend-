import { UserRole } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { logger } from "../../../lib/logger.js";

export class AuthRepository {
  
  private fail(
    operation: string,
    error: unknown,
    context: Record<string, unknown> = {},
  ) {
    logger.error("Authentication database operation failed", {
      operation,
      ...context,
      error,
    });
  }

  async findUserByEmail(email: string) {
    try {
      return await prisma.user.findUnique({ where: { email } });
    } catch (error) {
      this.fail("findUserByEmail", error);
      throw error;
    }
  }

  async findUserById(id: string) {
    try {
      return await prisma.user.findUnique({ where: { id } });
    } catch (error) {
      this.fail("findUserById", error, { actorId: id });
      throw error;
    }
  }

  async createUser(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: "PASSENGER" | "DRIVER";
    avatar?: string;
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            password: data.password,
            role: data.role as UserRole,
            avatar: data.avatar,
          },
        });
        if (data.role === "DRIVER")
          await tx.driver.create({ data: { userId: user.id } });
        
        return { user };
      });
    } catch (error) {
      this.fail("createUserWithOtp", error);
      throw error;
    }
  }

  async verifyEmail(userId: string) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { isEmailVerified: true },
      });
    } catch (error) {
      this.fail("verifyEmail", error, { actorId: userId });
      throw error;
    }
  }

  async recordLoginFailure(userId: string, lockUntil: Date | null) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: { increment: 1 },
          ...(lockUntil ? { lockedUntil: lockUntil } : {}),
        },
      });
    } catch (error) {
      this.fail("recordLoginFailure", error, { actorId: userId });
      throw error;
    }
  }

  async clearLoginFailures(userId: string) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    } catch (error) {
      this.fail("clearLoginFailures", error, { actorId: userId });
      throw error;
    }
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date) {
    try {
      return await prisma.refreshSession.create({
        data: { userId, tokenHash, expiresAt },
      });
    } catch (error) {
      this.fail("createSession", error, { actorId: userId });
      throw error;
    }
  }

  async rotateSession(
    tokenHash: string,
    replacementHash: string,
    expiresAt: Date,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const old = await tx.refreshSession.findUnique({
          where: { tokenHash },
          include: { user: true },
        });
        if (!old || old.revokedAt || old.expiresAt <= new Date()) return null;
        const session = await tx.refreshSession.create({
          data: { userId: old.userId, tokenHash: replacementHash, expiresAt },
        });
        return (
          await tx.refreshSession.updateMany({
            where: { id: old.id, revokedAt: null },
            data: { revokedAt: new Date(), replacedById: session.id },
          })
        ).count
          ? { user: old.user, session }
          : null;
      });
    } catch (error) {
      this.fail("rotateSession", error);
      throw error;
    }
  }

  async revokeSession(id: string) {
    try {
      return await prisma.refreshSession.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      this.fail("revokeSession", error);
      throw error;
    }
  }

  async isSessionActive(id: string) {
    try {
      return Boolean(
        await prisma.refreshSession.findFirst({
          where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
      );
    } catch (error) {
      this.fail("isSessionActive", error);
      throw error;
    }
  }

  async updatePasswordAndRevoke(userId: string, password: string) {
    try {
      return await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { password } }),
        prisma.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
    } catch (error) {
      this.fail("updatePasswordAndRevoke", error, { actorId: userId });
      throw error;
    }
  }

  async updatePassword(userId: string, password: string) {
    try {
      return await prisma.user.update({ where: { id: userId }, data: { password } });
    } catch (error) {
      this.fail("updatePassword", error, { actorId: userId });
      throw error;
    }
  }

  async consumeRateLimit(
    scope: string,
    keyHash: string,
    limit: number,
    windowMs: number,
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.authRateLimit.findUnique({
          where: { scope_keyHash: { scope, keyHash } },
        });
        const now = new Date();
        if (!row || now.getTime() - row.windowStart.getTime() >= windowMs) {
          await tx.authRateLimit.upsert({
            where: { scope_keyHash: { scope, keyHash } },
            create: { scope, keyHash, windowStart: now, count: 1 },
            update: { windowStart: now, count: 1 },
          });
          return true;
        }
        if (row.count >= limit) return false;
        await tx.authRateLimit.update({
          where: { id: row.id },
          data: { count: { increment: 1 } },
        });
        return true;
      });
    } catch (error) {
      this.fail("consumeRateLimit", error);
      throw error;
    }
  }

}
export const authRepository = new AuthRepository();
