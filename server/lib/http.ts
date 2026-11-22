import type { Request as ExpressRequest } from "express";

/** No route uses wildcard params, so every route param is a single string. */
export type Request = ExpressRequest<Record<string, string>>;
