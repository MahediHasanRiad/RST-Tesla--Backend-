import { z } from "zod";
import { isValidAvatar } from "../../../shared/media/avatar.validation.js";

const phone = z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, "Invalid phone number");

const avatar = z.object({
  buffer: z.instanceof(Buffer),
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
}).strict().superRefine((value, context) => {
  if (!isValidAvatar(value.buffer, value.mimetype))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid avatar image" });
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: phone.optional(),
  avatar: avatar.optional(),
}).strict().refine(
  (value) => value.name !== undefined || value.phone !== undefined || value.avatar !== undefined,
  "At least one profile field is required",
);

export const deleteProfileSchema = z.object({
  currentPassword: z.string().min(1).max(128),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
