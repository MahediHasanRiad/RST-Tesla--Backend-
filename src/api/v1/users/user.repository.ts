import {
  PoolStatus,
  Prisma,
  RideRequestStatus,
} from "../../../generated/prisma/client.js";
import { logger } from "../../../lib/logger.js";
import { prisma } from "../../../lib/prisma.js";
import type { UpdateProfileInput } from "./user.validation.js";

const safeProfile = {
  id: true,
  role: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export class UserRepository {
  private fail(
    operation: string,
    error: unknown,
    context: Record<string, unknown> = {},
  ) {
    logger.error("User profile database operation failed", {
      operation,
      ...context,
      error,
    });
  }

  async findSafeProfile(id: string) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        select: safeProfile,
      });
    } catch (error) {
      this.fail("findSafeProfile", error, { actorId: id });
      throw error;
    }
  }

  async findForDeletion(id: string) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        select: { id: true, password: true, avatarPublicId: true },
      });
    } catch (error) {
      this.fail("findForDeletion", error, { actorId: id });
      throw error;
    }
  }

  async phoneBelongsToAnother(phone: string, id: string) {
    try {
      return await prisma.user.findFirst({
        where: { phone, NOT: { id } },
        select: { id: true },
      });
    } catch (error) {
      this.fail("phoneBelongsToAnother", error, { actorId: id });
      throw error;
    }
  }

  async updateProfile(
    id: string,
    data: UpdateProfileInput,
    uploadedAvatar?: { url: string; publicId: string },
  ) {
    try {
      return await prisma.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(uploadedAvatar
            ? {
                avatar: uploadedAvatar.url,
                avatarPublicId: uploadedAvatar.publicId,
              }
            : {}),
        },
        select: { ...safeProfile, avatarPublicId: true },
      });
    } catch (error) {
      this.fail("updateProfile", error, { actorId: id });
      throw error;
    }
  }

  async deleteInactiveAccount(id: string) {
    try {
      return await prisma.user.delete({where: {id}})
    } catch (error) {
      this.fail("deleteInactiveAccount", error, { actorId: id });
      throw error;
    }
  }
}

export const userRepository = new UserRepository();
