import { z } from "zod";
import { offsetQuerySchema } from "../../../../shared/pagination/offset.js";


export const createRideRequestSchema = z
  .object({
    ridePoolId: z.string(),
    pickupZoneId: z.string().uuid(),
    destinationZoneId: z.string().uuid(),
    seats: z.coerce.number().int().min(1).max(10),
    enableRidePool: z.coerce.boolean().default(false),
    weatherCondition: z.enum(["CLEAR", "RAIN", "HEAVY_RAIN"]).default("CLEAR"),
  })
  .strict();

export type CreateRideRequestInput = z.infer<typeof createRideRequestSchema>;

export const freshRideRequestSchema = z
  .object({
    pickupZoneId: z.string().uuid(),
    destinationZoneId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    seats: z.coerce.number().int().min(1).max(10),
    enableRidePool: z.coerce.boolean().default(false),
    weatherCondition: z.enum(["CLEAR", "RAIN", "HEAVY_RAIN"]).default("CLEAR"),
  })
  .strict();

export type FreshRideRequestInput = z.infer<typeof freshRideRequestSchema>;

export const listAvailableRidePoolsSchema = z
  .object({
    pickupZoneId: z.string().uuid(),
    destinationZoneId: z.string().uuid(),
    seats: z.coerce.number().int().min(1).max(10).default(1),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ListAvailableRidePoolsQuery = z.infer<
  typeof listAvailableRidePoolsSchema
>;

export const listAvailableVehiclesSchema = z
  .object({
    pickupZoneId: z.string().uuid(),
    destinationZoneId: z.string().uuid(),
    seats: z.coerce.number().int().min(1).max(10).default(1),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ListAvailableVehiclesQuery = z.infer<
  typeof listAvailableVehiclesSchema
>;

export const rideRequestIdParamsSchema = z
  .object({ rideRequestId: z.string().uuid() })
  .strict();

export const counterFareSchema = z
  .object({ farePaisa: z.coerce.number().int().positive() })
  .strict();

export type CounterFareInput = z.infer<typeof counterFareSchema>;

export const completedRideHistoryQuerySchema = offsetQuerySchema;
