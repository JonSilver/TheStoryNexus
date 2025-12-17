import { z } from "zod";

export const parseJson = <T = unknown>(value: unknown): T | unknown => {
    if (typeof value !== "string") return value;
    const result = z
        .string()
        .transform(str => JSON.parse(str))
        .safeParse(value);
    return result.success ? result.data : value;
};
