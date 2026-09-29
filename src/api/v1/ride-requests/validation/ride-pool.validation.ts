import { z } from "zod";

export const openRidePoolSchema = z
  .object({
    pickupZoneId: z.string().uuid(),
    destinationZoneId: z.string().uuid(),
  })
  .strict();

export const joinRidePoolSchema = z
  .object({ poolId: z.string().uuid() })
  .strict();

export type OpenRidePoolInput = z.infer<typeof openRidePoolSchema>;
export type JoinRidePoolInput = z.infer<typeof joinRidePoolSchema>;

