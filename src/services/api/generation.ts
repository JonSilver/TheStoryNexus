import { attemptPromise } from "@jfdi/attempt";
import { createSSEParser, type GenerationStatus } from "@/services/ai/sseParser";
import type { AnsweredModel } from "@/types/actions";
import { openStream, request } from "./request";
import { describeStreamFailure } from "./requestFailure";

/**
 * The generation wire, once: open the SSE stream, read it as it arrives,
 * and say how it ended. Callers own their state; this owns only the wire.
 */
export type StreamEnd =
    | { end: "complete" }
    /** The writer stopped it (before or during streaming), or the server confirmed a Stop. */
    | { end: "stopped" }
    | { end: "failed"; error: string };

interface StreamHandlers {
    signal: AbortSignal;
    onModel?: (model: AnsweredModel) => void;
    onStatus?: (status: GenerationStatus) => void;
    onToken: (token: string) => void;
}

export const streamGeneration = async (
    body: object,
    { signal, onModel, onStatus, onToken }: StreamHandlers
): Promise<StreamEnd> => {
    const opened = await openStream("/generate/action", body, signal);
    if (!opened.ok) return opened.aborted ? { end: "stopped" } : { end: "failed", error: opened.error };

    const seen = { complete: false, aborted: false, error: null as string | null };
    const parser = createSSEParser({
        onModel,
        onStatus,
        onToken,
        onComplete: () => {
            seen.complete = true;
        },
        onAborted: () => {
            seen.aborted = true;
        },
        onError: error => {
            seen.error = error.message;
        }
    });
    const reader = opened.response.body?.getReader();
    if (!reader) return { end: "failed", error: "No response stream" };
    const decoder = new TextDecoder();
    const [readError] = await attemptPromise(async () => {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                parser.push(decoder.decode());
                parser.end();
                return;
            }
            parser.push(decoder.decode(value, { stream: true }));
        }
    });
    if ((readError as Error)?.name === "AbortError" || seen.aborted) return { end: "stopped" };
    if (readError) return { end: "failed", error: describeStreamFailure(readError) };
    if (seen.error) return { end: "failed", error: seen.error };
    return seen.complete ? { end: "complete" } : { end: "failed", error: "The response ended unexpectedly." };
};

/** Tells the server to stop paying the provider for a run this client has abandoned. */
export const abortGeneration = (requestId: string) => void request("/generate/abort", { json: { requestId } });
