import { attemptPromise } from "@jfdi/attempt";
import type { Request as ExpressRequest, Response } from "express";

/** No route uses wildcard params, so every route param is a single string. */
export type Request = ExpressRequest<Record<string, string>>;

type Handler = (req: Request, res: Response) => Promise<void>;

interface AsyncHandlerOptions {
    label?: string;
    /** Maps an expected error to its status; mapped errors are not logged. */
    statusOf?: (error: Error) => number | undefined;
}

export const makeAsyncHandler =
    ({ label = "Error", statusOf = () => undefined }: AsyncHandlerOptions = {}) =>
    (fn: Handler) =>
    async (req: Request, res: Response) => {
        const [error] = await attemptPromise(() => fn(req, res));
        if (!error) return;
        const status = statusOf(error);
        if (!status) console.error(`${label}:`, error);
        res.status(status ?? 500).json({ error: error.message || "Server error" });
    };

export const asyncHandler = makeAsyncHandler();
