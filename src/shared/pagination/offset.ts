import { z } from "zod";

export const DEFAULT_OFFSET_LIMIT = 20;
export const MAX_OFFSET_LIMIT = 100;

export const offsetQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_OFFSET_LIMIT)
      .default(DEFAULT_OFFSET_LIMIT),
  })
  .strict();

export function createOffsetPage<T>(
  items: T[],
  page: number,
  limit: number,
  totalItems: number,
) {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    items,
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
  };
}
