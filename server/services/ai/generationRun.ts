/**
 * Runs one generation and narrates it. The writer must never stare at a
 * silent spinner: while waiting, a status heartbeat says WHICH phase we're in
 * (provider hasn't accepted the request / accepted but no text yet /
 * streaming) and how long it's been.
 * Each phase has its own timeout and its own specific error naming the model
 * and server. Provider errors are described in writer terms, not passed
 * through as bare status codes. Provider-agnostic: nothing here knows or
 * cares what kind of server sits behind the API.
 */

export type GenerationPhase = "waiting" | "thinking" | "streaming";

export type GenerationEvent =
    | { type: "status"; phase: GenerationPhase; elapsedMs: number }
    | { type: "token"; text: string }
    | { type: "error"; message: string }
    | { type: "finish" }
    | { type: "aborted" };

export interface GenerationTimeouts {
    /** Provider hasn't accepted the request (no response headers) — queued, loading a model, or stuck. */
    acceptMs: number;
    /** Accepted, but no text yet — prompt processing / hidden reasoning. */
    firstTokenMs: number;
    /** Text was flowing and stopped. */
    stallMs: number;
    heartbeatMs: number;
}

export const DEFAULT_TIMEOUTS: GenerationTimeouts = {
    // Generous: a cold load of a 30B-class local model, or a model swap behind
    // a busy server, legitimately takes minutes — the writer SEES it waiting
    acceptMs: 180_000,
    firstTokenMs: 120_000,
    stallMs: 60_000,
    heartbeatMs: 2_000
};

export interface RunGenerationOptions {
    open: (signal: AbortSignal) => Promise<AsyncIterable<string>>;
    /** The writer's Stop / disconnect. */
    signal: AbortSignal;
    emit: (event: GenerationEvent) => void;
    /** Names the model and server in every message, e.g. "Skyfall-31B on the local server at host:port" */
    target: string;
    /** Extra context for a model-not-found error (e.g. which override chose the model). */
    modelSourceHint?: string;
    timeouts?: Partial<GenerationTimeouts>;
    now?: () => number;
}

const seconds = (ms: number) => Math.round(ms / 1000);
const minutesOrSeconds = (ms: number) =>
    ms >= 120_000 ? `${Math.round(ms / 60_000)} minutes` : `${seconds(ms)} seconds`;

interface ProviderErrorShape {
    status?: number;
    message?: string;
    code?: string;
    cause?: { code?: string; message?: string };
    name?: string;
}

/** Turns SDK/network errors into a message a writer can act on. */
export const describeProviderError = (error: unknown, target: string, modelSourceHint?: string): string => {
    const e = (error ?? {}) as ProviderErrorShape;
    const raw = (e.message ?? "").replace(/^\d{3}\s+/, "").trim();
    const detail = raw ? ` (${raw})` : "";
    const code = e.code ?? e.cause?.code ?? "";

    if (e.status === 404)
        return `${target}: the server doesn't have this model${detail}. Pick an available model in Settings${
            modelSourceHint ? `, or fix ${modelSourceHint}` : ""
        }.`;
    if (e.status === 401 || e.status === 403)
        return `${target}: the API key was rejected${detail}. Check it in Settings.`;
    if (e.status === 429)
        return `${target}: the provider is rate-limiting or too busy right now${detail}. Try again shortly.`;
    if (e.status === 400) return `${target}: the provider rejected the request${detail}.`;
    if (e.status && e.status >= 500) return `${target}: the model server reported an error ${e.status}${detail}.`;
    if (
        /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET|ETIMEDOUT/.test(code) ||
        /Connection error|fetch failed/i.test(raw)
    )
        return `${target}: couldn't reach the model server${code ? ` (${code})` : detail}. Is it running, and is the address in Settings right?`;
    return `${target}: generation failed${detail || " with no explanation from the provider"}.`;
};

export const runGeneration = async ({
    open,
    signal,
    emit,
    target,
    modelSourceHint,
    timeouts: overrides,
    now = Date.now
}: RunGenerationOptions): Promise<void> => {
    const t = { ...DEFAULT_TIMEOUTS, ...overrides };
    const startedAt = now();
    const state: { phase: GenerationPhase; failure: string | null } = { phase: "waiting", failure: null };
    const internal = new AbortController();
    const abortAll = () => internal.abort();
    signal.addEventListener("abort", abortAll, { once: true });

    const fail = (message: string) => {
        if (state.failure) return;
        state.failure = message;
        internal.abort();
    };

    const emitStatus = () => emit({ type: "status", phase: state.phase, elapsedMs: now() - startedAt });

    const timers = {
        heartbeat: setInterval(() => {
            if (state.phase !== "streaming") emitStatus();
        }, t.heartbeatMs),
        phase: null as ReturnType<typeof setTimeout> | null
    };

    const armPhaseTimer = (ms: number, message: () => string) => {
        if (timers.phase) clearTimeout(timers.phase);
        timers.phase = setTimeout(() => fail(message()), ms);
    };

    const enter = (phase: GenerationPhase) => {
        state.phase = phase;
        emitStatus();
    };

    emitStatus();
    armPhaseTimer(
        t.acceptMs,
        () =>
            `${target} didn't start responding within ${minutesOrSeconds(t.acceptMs)}. ` +
            "The server may be overloaded, still loading the model, or stuck."
    );

    // Every wait races the internal abort: a provider that ignores the abort
    // signal (holds the socket, never yields) must not hang the runner
    const abortedRace = new Promise<never>((_, reject) => {
        const rejectNow = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (internal.signal.aborted) rejectNow();
        else internal.signal.addEventListener("abort", rejectNow, { once: true });
    });
    abortedRace.catch(() => undefined);

    const outcome = await (async (): Promise<{ error?: unknown; produced: boolean }> => {
        const produced = { value: false };
        try {
            const stream = await Promise.race([open(internal.signal), abortedRace]);
            enter("thinking");
            armPhaseTimer(
                t.firstTokenMs,
                () =>
                    `${target} accepted the request but produced no text within ${minutesOrSeconds(t.firstTokenMs)}. ` +
                    "A reasoning model may be thinking at length — raise max tokens, or try a non-thinking model."
            );
            const iterator = stream[Symbol.asyncIterator]();
            try {
                while (true) {
                    const next = await Promise.race([iterator.next(), abortedRace]);
                    if (next.done) break;
                    const token = next.value;
                    if (state.phase !== "streaming") enter("streaming");
                    if (token.trim()) produced.value = true;
                    emit({ type: "token", text: token });
                    armPhaseTimer(
                        t.stallMs,
                        () =>
                            `${target} stopped sending text for ${seconds(t.stallMs)} seconds partway through. What arrived has been kept.`
                    );
                }
            } finally {
                // Release the provider stream; a misbehaving one may never settle, so don't await it
                void Promise.resolve(iterator.return?.()).catch(() => undefined);
            }
            return { produced: produced.value };
        } catch (error) {
            return { error, produced: produced.value };
        }
    })();

    clearInterval(timers.heartbeat);
    if (timers.phase) clearTimeout(timers.phase);
    signal.removeEventListener("abort", abortAll);

    if (state.failure) emit({ type: "error", message: state.failure });
    else if (signal.aborted) emit({ type: "aborted" });
    else if (outcome.error)
        emit({ type: "error", message: describeProviderError(outcome.error, target, modelSourceHint) });
    // A clean stream with no content is a failure, not a completion — thinking
    // models can spend the whole token budget on hidden reasoning
    else if (!outcome.produced)
        emit({
            type: "error",
            message: `${target} finished without producing any text — it may have spent its token budget on hidden reasoning. Raise max tokens for this action or use a non-thinking model.`
        });
    else emit({ type: "finish" });
};
