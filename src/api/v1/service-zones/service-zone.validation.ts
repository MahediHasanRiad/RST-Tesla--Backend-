import { z } from "zod";

export const createServiceZoneSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    latitude: z.coerce.number().finite().min(-90).max(90),
    longitude: z.coerce.number().finite().min(-180).max(180),
  })
  .strict();

export type CreateServiceZoneInput = z.infer<typeof createServiceZoneSchema>;
