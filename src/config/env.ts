import "dotenv/config";
import { z } from "zod";

const environment = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string(),
  JWT_ISSUER: z.string().min(1).default("dhaka-tesla-pool-api"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().min(1).default("Dhaka Tesla Pool"),
  AVATAR_MAX_BYTES: z.coerce.number().int().positive().max(10 * 1024 * 1024).default(5 * 1024 * 1024),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.BREVO_API_KEY)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["BREVO_API_KEY"],
      message: "BREVO_API_KEY is required in production",
    });
  if (value.NODE_ENV === "production" && !value.BREVO_SENDER_EMAIL)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["BREVO_SENDER_EMAIL"],
      message: "BREVO_SENDER_EMAIL is required in production",
    });
});

export const env = environment.parse(process.env);
