import { attemptPromise } from "@jfdi/attempt";
import { createSSEParser, type GenerationStatus } from "@/services/ai/sseParser";
import { randomUUID } from "@/utils/crypto";
import type { ActionEditorContext, ActionId } from "./useActionGeneration";

export interface StreamActionRequest {
    actionId: ActionId;
    storyId: string;
    chapterId?: string;
    editorContext?: ActionEditorContext;
}

export interface StreamActionHandlers {
    onStatus?: (status: GenerationStatus) => void;
    onToken: (token: string) => void;
    /** Exactly once: error is undefined for success/abort (partial tokens already delivered). */
    onDone: (error?: string) => void;
}

/**
 * Shared streaming skeleton for action generation: one requestId, abort
 * propagated server-side, buffered SSE parsing, single onDone. Callers own
 * all state — this owns only the wire.
 */
export const streamAction = (request: StreamActionRequest, handlers: StreamActionHandlers) => {
    const requestId = randomUUID();
    const controller = new AbortController();
    const finished = { done: false };

    const done = (error?: string) => {
        if (finished.done) return;
        finished.done = true;
        handlers.onDone(error);
    };

    void (async () => {
        const [fetchError, response] = await attemptPromise(() =>
            fetch("/api/generate/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, ...request }),
                signal: controller.signal
            })
        );
        if (fetchError || !response) {
            done(
                (fetchError as Error)?.name === "AbortError"
                    ? undefined
                    : ((fetchError as Error)?.message ?? "Request failed")
            );
            return;
        }
        if (!response.ok || !response.body) {
            const body = await response.json().catch(() => ({}));
            done(body.error || `Generation failed (${response.status})`);
            return;
        }

        const parser = createSSEParser({
            onStatus: handlers.onStatus,
            onToken: handlers.onToken,
            onComplete: () => done(),
            onError: error => done(error.message)
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const [readError] = await attemptPromise(async () => {
            while (true) {
                const { done: finishedReading, value } = await reader.read();
                if (finishedReading) {
                    parser.push(decoder.decode());
                    parser.end();
                    break;
                }
                parser.push(decoder.decode(value, { stream: true }));
            }
        });
        if (readError) done((readError as Error).name === "AbortError" ? undefined : (readError as Error).message);
    })();

    return {
        abort: () => {
            controller.abort();
            void attemptPromise(() =>
                fetch("/api/generate/abort", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requestId })
                })
            );
        }
    };
};
