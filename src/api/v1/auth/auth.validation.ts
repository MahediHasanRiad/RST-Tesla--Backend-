import { z } from "zod";
import { isValidAvatar } from "../../../shared/media/avatar.validation.js";

const email = z.string().trim().toLowerCase().email().max(254);
const phone = z
  .string()
  .trim()

const password = z
  .string()


const otp = z.string().regex(/^\d{6}$/);

const avatarSchema = z
  .object({
    buffer: z.instanceof(Buffer),
    mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
  })
  .strict()
  .superRefine((avatar, context) => {
    if (!isValidAvatar(avatar.buffer, avatar.mimetype))
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid avatar image" });
  });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email,
    phone,
    password,
    role: z.enum(["PASSENGER", "DRIVER"]).default('PASSENGER'),
    avatar: avatarSchema.optional()
  })
  .strict();


export const verifyOtpSchema = z.object({ email, otp }).strict();
export const resendVerificationSchema = z.object({ email }).strict();
export const loginSchema = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z.object({ email, otp, password }).strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), password })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegistrationRequestType = z.infer<typeof registerSchema>;
