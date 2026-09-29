import type { Request, Response } from "express";
import { ApiError } from "../../../../shared/http/api-error.js";
import { sendSuccess } from "../../../../shared/http/api-response.js";
import { vehicleRepository } from "../vehicle.repository.js";
import { updateVehicleSchema } from "../vehicle.validation.js";
import { deleteUploadedAvatar, uploadAvatar } from "../../../../shared/media/avatar.js";

export async function updateVehicleController(
  request: Request,
  response: Response,
) {
  
  if (!request.user) throw new ApiError(401, "unauthenticated");
  if (request.user.role !== "DRIVER") throw new ApiError(403, "forbidden");

  const driver = await vehicleRepository.findDriverByUserId(request.user.id);

  // verification
  if (request.user.id !== driver?.userId)
    throw new ApiError(
      403,
      "Does not have permission to update this Behicle !!!",
    );

  if (!driver) throw new ApiError(404, "driver_not_found");

  const input = updateVehicleSchema.parse({
    ...request.body,
    ...(Array.isArray(request.files) && request.files.length > 0
      ? {
          images: request.files.map((file) => ({
            buffer: file.buffer,
            mimetype: file.mimetype,
          })),
        }
      : {}),
  });

  const uploadedImages: { url: string; publicId: string }[] = [];

  try {
    if (input.images) {
      for (const image of input.images)
        uploadedImages.push(await uploadAvatar(image.buffer, image.mimetype));
    }

    const { images: _images, ...vehicleFields } = input;
    const result = await vehicleRepository.update(driver.id, {
      ...vehicleFields,
      ...(input.images ? { images: uploadedImages.map((image) => image.url) } : {}),
    });

    if (result.kind === "missing") throw new ApiError(404, "vehicle_not_found");
    if (result.kind === "capacity_conflict")
      throw new ApiError(409, "vehicle_capacity_conflict");

    return sendSuccess(response, 200, result.vehicle);
  } 
  catch (error) {
    await Promise.all(
      uploadedImages.map((image) =>
        deleteUploadedAvatar(image.publicId).catch(() => undefined),
      ),
    );
    throw error;
  }
}
