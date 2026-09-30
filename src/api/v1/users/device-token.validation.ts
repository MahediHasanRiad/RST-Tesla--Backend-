import { z } from "zod";

export const deviceTokenSchema = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
}).strict();

export const removeDeviceTokenSchema = z.object({
  token: z.string().trim().min(20).max(4096),
}).strict();
