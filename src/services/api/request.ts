import { describeRequestFailure } from "./requestFailure";

/**
 * The one place the app talks HTTP to its own server. Everything else goes
 * through `request` (or the helpers built on it), so headers, error wording
 * and failure shapes are decided here once — e.g. an auth header is a
 * one-line change in `send`.
 */
const API_BASE = "/api";

export type ApiResult<T> =
    | { ok: true; status: number; data: T }
    /** status 0: no answer at all (network down, or aborted — see `aborted`). */
    | { ok: false; status: number; error: string; body: unknown; aborted: boolean };

interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    /** Sent as JSON. */
    json?: unknown;
    /** Sent as multipart (uploads). */
    form?: FormData;
    signal?: AbortSignal;
    /** Survives page teardown (exit saves); the browser caps the body at ~64KB. */
    keepalive?: boolean;
}

const send = (path: string, { method, json, form, signal, keepalive }: RequestOptions) =>
    fetch(`${API_BASE}${path}`, {
        method: method ?? (json !== undefined || form ? "POST" : "GET"),
        ...(json !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) }),
        ...(form && { body: form }),
        signal,
        keepalive
    });

const readBody = async (response: Response): Promise<unknown> => {
    if (response.status === 204) return undefined;
    const text = await response.text().catch(() => "");
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

const errorText = (body: unknown, status: number): string => {
    const { error, details } = (body ?? {}) as { error?: string; details?: unknown };
    if (error) return typeof details === "string" ? `${error}: ${details}` : error;
    return `Request failed (${status})`;
};

/** Never throws: every outcome — success, HTTP error, no answer, abort — is a value. */
export const request = async <T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> => {
    const response = await send(path, options).catch((error: Error) => error);
    if (response instanceof Error) {
        const aborted = response.name === "AbortError";
        return {
            ok: false,
            status: 0,
            error: aborted ? "Stopped" : describeRequestFailure(response),
            body: undefined,
            aborted
        };
    }
    const body = await readBody(response);
    return response.ok
        ? { ok: true, status: response.status, data: body as T }
        : { ok: false, status: response.status, error: errorText(body, response.status), body, aborted: false };
};

/**
 * A streaming response (generation): the open Response on success, so the
 * caller reads the body as it arrives; failures are the same values `request` returns.
 */
export const openStream = async (
    path: string,
    json: unknown,
    signal?: AbortSignal
): Promise<{ ok: true; response: Response } | Extract<ApiResult<never>, { ok: false }>> => {
    const response = await send(path, { method: "POST", json, signal }).catch((error: Error) => error);
    if (response instanceof Error) {
        const aborted = response.name === "AbortError";
        return {
            ok: false,
            status: 0,
            error: aborted ? "Stopped" : describeRequestFailure(response),
            body: undefined,
            aborted
        };
    }
    if (response.ok && response.body) return { ok: true, response };
    const body = await readBody(response);
    return { ok: false, status: response.status, error: errorText(body, response.status), body, aborted: false };
};

/** For query hooks: the data, or a thrown Error carrying the status. */
export const fetchJSON = async <T>(path: string, options?: Pick<RequestOptions, "method" | "json">) =>
    orThrow(await request<T>(path, options));

export const uploadFile = async <T>(path: string, file: File): Promise<T> => {
    const form = new FormData();
    form.append("file", file);
    return orThrow(await request<T>(path, { form }));
};

/** For mutations and queries: a result's data, or a thrown Error carrying status and body. */
export const orThrow = <T>(result: ApiResult<T>): T => {
    if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status, body: result.body });
    return result.data;
};
