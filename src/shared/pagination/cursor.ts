import { z } from "zod";
import { ApiError } from "../http/api-error.js";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

const cursorPayloadSchema = z
  .object({
    createdAt: z.string().datetime(),
    id: z.string().min(1),
  })
  .strict();

export const cursorQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  })
  .strict();

export type CursorPosition = z.infer<typeof cursorPayloadSchema>;
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export function encodeCursor(position: CursorPosition) {
  return Buffer.from(JSON.stringify(position), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPosition {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = cursorPayloadSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success) throw new Error("Invalid cursor payload");
    return parsed.data;
  } catch {
    throw new ApiError(400, "invalid_cursor");
  }
}

export function parseCursorQuery(query: unknown): CursorQuery & {
  position?: CursorPosition;
} {
  const parsed = cursorQuerySchema.parse(query);
  return {
    ...parsed,
    position: parsed.cursor ? decodeCursor(parsed.cursor) : undefined,
  };
}

export function createCursorPage<T>(
  items: T[],
  limit: number,
  hasNextPage: boolean,
  getPosition: (item: T) => CursorPosition,
) {
  return {
    items,
    nextCursor:
      hasNextPage && items.length > 0
        ? encodeCursor(getPosition(items[items.length - 1]))
        : null,
    hasNextPage,
  };
}
