import "dotenv/config";
import { z } from "zod";

const tokenTtl = (fallback: string) =>
  z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().trim().regex(/^[1-9]\d*(?:\s*[smhdw])?$/i).default(fallback),
  ).transform((value) => /^\d+$/.test(value) ? `${value}s` : value.replace(/\s+/g, ""));

const environment = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CLUSTER_WORKERS: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string(),
  JWT_ISSUER: z.string().min(1).default("dhaka-tesla-pool-api"),
  ACCESS_TOKEN_TTL_SECONDS: tokenTtl("900s"),
  ACCESS_TOKEN_SECRET_KEY:z.string(),
  REFRESH_TOKEN_TTL_SECONDS: tokenTtl("30d"),
  LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().min(1).default("Dhaka Tesla Pool"),
  AVATAR_MAX_BYTES: z.coerce.number().int().positive().max(10 * 1024 * 1024).default(5 * 1024 * 1024),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  QUEUE_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  QUEUE_NOTIFICATION_CONCURRENCY: z.coerce.number().int().positive().default(5),
  QUEUE_EMAIL_CONCURRENCY: z.coerce.number().int().positive().default(3),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  VAPID_key: z.string().min(1).optional(),
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
