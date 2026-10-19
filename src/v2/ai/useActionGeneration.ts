import { attemptPromise } from "@jfdi/attempt";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSSEParser, type GenerationStatus } from "@/services/ai/sseParser";
import { randomUUID } from "@/utils/crypto";
import { describeRequestFailure, describeStreamFailure } from "./requestFailure";

export type ActionId =
    | "continue"
    | "rework"
    | "expand"
    | "shorten"
    | "summarise_chapter"
    | "brainstorm"
    | "scene_beat"
    | "extract_entries"
    | "propose_updates"
    | "ask"
    | "check_continuity"
    | "merge_entries";

export interface ActionEditorContext {
    selection?: string;
    recentProse?: string;
    command?: string;
    povCharacter?: string;
    povType?: string;
    userMessage?: string;
    chatHistory?: string;
    guidance?: string;
}

export interface ActionRun {
    actionId: ActionId;
    storyId: string;
    chapterId?: string;
    editorContext?: ActionEditorContext;
}

export type GenerationPhase = "idle" | "streaming" | "done" | "error";

/**
 * What a run produced. A failed or stopped run still carries any text that
 * arrived before it ended; "superseded" means a newer run took over.
 */
export interface RunResult {
    text: string;
    outcome: "complete" | "stopped" | "failed" | "superseded";
    error?: string;
}

/**
 * Per-invocation action generation against POST /api/generate/action.
 * Own requestId and abort per run — no shared singleton state.
 */
export const useActionGeneration = () => {
    const [phase, setPhase] = useState<GenerationPhase>("idle");
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<GenerationStatus | null>(null);
    const active = useRef<{ requestId: string; controller: AbortController } | null>(null);

    const unmounted = useRef(false);
    // Abort any in-flight generation when the owning component unmounts
    useEffect(
        () => () => {
            unmounted.current = true;
            active.current?.controller.abort();
            active.current = null;
        },
        []
    );

    const abort = useCallback(() => {
        const current = active.current;
        if (!current) return;
        current.controller.abort();
        void attemptPromise(() =>
            fetch("/api/generate/abort", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: current.requestId })
            })
        );
        // Deliberately NOT clearing active here: the aborted run still owns
        // its completion and must transition streaming → done itself. A
        // superseding run() disowns it by replacing active instead.
    }, []);

    const reset = useCallback(() => {
        // Deliberate teardown: unlike Stop, reset DISOWNS the run so a late
        // rejection from its reader can't overwrite the idle state
        const current = active.current;
        active.current = null;
        if (current) {
            current.controller.abort();
            void attemptPromise(() =>
                fetch("/api/generate/abort", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requestId: current.requestId })
                })
            );
        }
        setPhase("idle");
        setText("");
        setError(null);
        setStatus(null);
    }, []);

    const run = useCallback(
        async (request: ActionRun): Promise<RunResult> => {
            abort();
            const requestId = randomUUID();
            const controller = new AbortController();
            active.current = { requestId, controller };
            setPhase("streaming");
            setText("");
            setError(null);
            setStatus({ phase: "waiting", elapsedMs: 0 });

            const chunks: string[] = [];
            const outcome: { complete: boolean; aborted: boolean; streamError: string | null } = {
                complete: false,
                aborted: false,
                streamError: null
            };
            // Only the request that still owns `active` may touch state —
            // a superseded run's late callbacks must not clobber its successor
            const owns = () => active.current?.requestId === requestId;
            const superseded: RunResult = { text: "", outcome: "superseded" };
            const failed = (message: string): RunResult => {
                setPhase("error");
                setError(message);
                return { text: chunks.join(""), outcome: "failed", error: message };
            };

            const [fetchError, response] = await attemptPromise(() =>
                fetch("/api/generate/action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requestId, ...request }),
                    signal: controller.signal
                })
            );

            if (fetchError || !response) {
                if (!owns()) return superseded;
                active.current = null;
                // AbortError = instant Stop before headers: end cleanly with
                // no stranded streaming state; anything else is a real error
                if ((fetchError as Error)?.name !== "AbortError") return failed(describeRequestFailure(fetchError));
                setPhase("done");
                return { text: "", outcome: "stopped" };
            }
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                if (!owns()) return superseded;
                active.current = null;
                return failed(body.error || `Generation failed (${response.status})`);
            }

            const parser = createSSEParser({
                onStatus: next => {
                    if (owns()) setStatus(next);
                },
                onToken: token => {
                    if (!owns()) return;
                    chunks.push(token);
                    setText(chunks.join(""));
                },
                onComplete: () => {
                    outcome.complete = true;
                },
                onAborted: () => {
                    outcome.aborted = true;
                },
                onError: streamError => {
                    outcome.streamError = streamError.message;
                }
            });

            const reader = response.body?.getReader();
            if (!reader) {
                if (!owns()) return superseded;
                active.current = null;
                return failed("No response stream");
            }
            const decoder = new TextDecoder();
            const [readError] = await attemptPromise(async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        parser.push(decoder.decode());
                        parser.end();
                        break;
                    }
                    parser.push(decoder.decode(value, { stream: true }));
                }
            });

            // Left mid-stream (the screen closed): what arrived is still the writer's — callers
            // that persist (Brainstorm) keep it; no state is touched on the unmounted hook
            if (!owns())
                return unmounted.current && chunks.length ? { text: chunks.join(""), outcome: "stopped" } : superseded;
            active.current = null;
            // Stopped mid-stream: what arrived is the writer's to accept or discard
            if ((readError as Error)?.name === "AbortError" || outcome.aborted) {
                setPhase("done");
                return { text: chunks.join(""), outcome: "stopped" };
            }
            // A failure keeps whatever text arrived first — callers decide how to offer it
            if (readError) return failed(describeStreamFailure(readError));
            if (outcome.streamError) return failed(outcome.streamError);
            if (!outcome.complete) return failed("The response ended unexpectedly.");
            setPhase("done");
            return { text: chunks.join(""), outcome: "complete" };
        },
        [abort]
    );

    return { phase, text, error, status: phase === "streaming" ? status : null, run, abort, reset };
};
