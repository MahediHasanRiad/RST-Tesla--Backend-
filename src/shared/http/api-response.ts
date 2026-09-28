import type { Response } from "express";

export function sendSuccess(response: Response, status: number, data: unknown) {
  return response
    .status(status)
    .json({ success: true, data, requestId: response.req.requestId });
}

export function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  return response
    .status(status)
    .json({
      success: false,
      error: { code, message },
      requestId: response.req.requestId,
    });
}
