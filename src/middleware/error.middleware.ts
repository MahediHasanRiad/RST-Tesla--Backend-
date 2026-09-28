import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { logger } from "../lib/logger.js";
import { ApiError } from "../shared/http/api-error.js";
import { sendError } from "../shared/http/api-response.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  _next,
) => {
  if (error instanceof ApiError)
    return sendError(response, error.status, error.code, error.message);
  if (error instanceof ZodError)
    return sendError(
      response,
      400,
      "validation_failed",
      "Invalid request input",
    );
  if (error instanceof multer.MulterError)
    return sendError(response, 400, "upload_invalid", "Invalid upload");
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return sendError(response, 409, "conflict", "Resource already exists");
  logger.error("Unhandled request error", {
    requestId: request.requestId,
    error,
  });
  return sendError(
    response,
    500,
    "internal_error",
    "An unexpected error occurred",
  );
};
