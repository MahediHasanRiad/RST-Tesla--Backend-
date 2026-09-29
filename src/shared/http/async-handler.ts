import type { Request, Response, NextFunction } from "express"

type asyncHandlerType = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<unknown>

export const asyncHandler = (fn: asyncHandlerType) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        await fn(req, res, next)
    } catch (error: any) {
        console.log(error?.response?.data?.message || error?.message)
        next(error)
    }
}
