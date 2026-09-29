import { z } from "zod";
import { isValidAvatar } from "../../../shared/media/avatar.validation.js";

const image = z.object({
  buffer: z.instanceof(Buffer),
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
}).strict().superRefine((value, context) => {
  if (!isValidAvatar(value.buffer, value.mimetype))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid vehicle image" });
});

const vehicleFields = {
  name: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(1).max(10),
  availability: z.enum(["OFFLINE", "ONLINE"]).default('ONLINE'),
  images: z.array(image).max(5),
};

export const createVehicleSchema = z.object({
  ...vehicleFields,
  availability: vehicleFields.availability.default("OFFLINE"),
  images: vehicleFields.images.default([]),
}).strict();

export const updateVehicleSchema = z.object({
  name: vehicleFields.name.optional(),
  capacity: vehicleFields.capacity.optional(),
  availability: vehicleFields.availability.optional(),
  images: vehicleFields.images.optional(),
}).strict().refine(
  (value) => Object.values(value).some((item) => item !== undefined),
  "At least one vehicle field is required",
);

export const vehicleIdParamsSchema = z
  .object({ vehicleId: z.string().uuid() })
  .strict();

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
