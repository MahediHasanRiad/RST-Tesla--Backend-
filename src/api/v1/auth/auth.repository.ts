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
  async findUserForLogin(email: string) {
    try {
      return await prisma.user.findUnique({
        where: { email },
        include: { driver: true },
      });
    } catch (error) {
      this.fail("findUserForLogin", error);
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
    avatarPublicId?: string;
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
            avatarPublicId: data.avatarPublicId,
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

  async updatePassword(userId: string, password: string) {
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: { password },
      });
    } catch (error) {
      this.fail("updatePassword", error, { actorId: userId });
      throw error;
    }
  }

}
export const authRepository = new AuthRepository();
