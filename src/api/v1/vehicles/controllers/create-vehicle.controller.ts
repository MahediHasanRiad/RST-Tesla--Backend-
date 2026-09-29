import type { Request, Response } from "express";
import { Prisma } from "../../../../generated/prisma/client.js";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { vehicleRepository } from "../vehicle.repository.js";
import { createVehicleSchema } from "../vehicle.validation.js";
import { deleteUploadedAvatar, uploadAvatar } from "../../../../shared/media/avatar.js";


export async function createVehicleController(
  request: Request,
  response: Response,
) {
  if (!request.user) throw new ApiError(401, "unauthenticated !");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  const driver = await vehicleRepository.findDriverByUserId(request.user.id);
  if (!driver) throw new ApiError(404, "driver_not_found");
  
  const input = createVehicleSchema.parse({
    ...request.body,
    images: Array.isArray(request.files)
      ? request.files.map((file) => ({ buffer: file.buffer, mimetype: file.mimetype }))
      : [],
  });

  const uploadedImages: { url: string; publicId: string }[] = [];

  try {
    for (const image of input.images)
      uploadedImages.push(await uploadAvatar(image.buffer, image.mimetype));
    return sendSuccess(
      response,
      201,
      await vehicleRepository.create(
        driver?.id,
        { ...input, images: uploadedImages.map((image) => image.url) },
      ),
    );
  } catch (error) {
    const responseError =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
        ? new ApiError(409, "vehicle_exists")
        : error;
    await Promise.all(uploadedImages.map((image) => deleteUploadedAvatar(image.publicId).catch(() => undefined)));
    throw responseError;
  }
}
