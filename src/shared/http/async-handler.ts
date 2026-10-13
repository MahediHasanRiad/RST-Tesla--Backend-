import type { Request, Response, NextFunction } from "express"
import { logger } from "../../lib/logger.js";

type asyncHandlerType = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<unknown>

export const asyncHandler = (fn: asyncHandlerType) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        await fn(req, res, next)
    } catch (error: any) {
        logger.debug("Async request handler failed", {
            requestId: req.requestId,
            errorName: error instanceof Error ? error.name : "UnknownError",
        });
        next(error)
    }
}
