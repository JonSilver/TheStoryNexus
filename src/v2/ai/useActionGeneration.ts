import { attemptPromise } from "@jfdi/attempt";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSSEParser, type GenerationStatus } from "@/services/ai/sseParser";
import { randomUUID } from "@/utils/crypto";

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
 * Per-invocation action generation against POST /api/generate/action.
 * Own requestId and abort per run — no shared singleton state.
 */
export const useActionGeneration = () => {
    const [phase, setPhase] = useState<GenerationPhase>("idle");
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<GenerationStatus | null>(null);
    const active = useRef<{ requestId: string; controller: AbortController } | null>(null);

    // Abort any in-flight generation when the owning component unmounts
    useEffect(
        () => () => {
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
        async (request: ActionRun): Promise<string> => {
            abort();
            const requestId = randomUUID();
            const controller = new AbortController();
            active.current = { requestId, controller };
            setPhase("streaming");
            setText("");
            setError(null);
            setStatus({ phase: "waiting", elapsedMs: 0 });

            const chunks: string[] = [];
            const finished = { ok: false };
            // Only the request that still owns `active` may touch state —
            // a superseded run's late callbacks must not clobber its successor
            const owns = () => active.current?.requestId === requestId;

            const [fetchError, response] = await attemptPromise(() =>
                fetch("/api/generate/action", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requestId, ...request }),
                    signal: controller.signal
                })
            );

            if (fetchError || !response) {
                if (!owns()) return "";
                active.current = null;
                // AbortError = instant Stop before headers: end cleanly with
                // no stranded streaming state; anything else is a real error
                if ((fetchError as Error)?.name === "AbortError") setPhase("done");
                else {
                    setPhase("error");
                    setError((fetchError as Error)?.message ?? "Request failed");
                }
                return "";
            }
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                if (owns()) {
                    setPhase("error");
                    setError(body.error || `Generation failed (${response.status})`);
                }
                return "";
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
                    finished.ok = true;
                },
                onError: streamError => {
                    if (!owns()) return;
                    setPhase("error");
                    setError(streamError.message);
                }
            });

            const reader = response.body?.getReader();
            if (!reader) {
                if (owns()) {
                    setPhase("error");
                    setError("No response stream");
                }
                return "";
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

            if (!owns()) return "";
            active.current = null;
            if (readError)
                if ((readError as Error).name === "AbortError") {
                    // Stopped mid-stream: keep the partial text and let the
                    // user accept or discard it — callers that persist the
                    // reply (brainstorm) get the partial too, not ""
                    setPhase("done");
                    return chunks.join("");
                } else {
                    setPhase("error");
                    setError((readError as Error).message);
                    return "";
                }
            if (finished.ok) setPhase("done");
            return finished.ok ? chunks.join("") : "";
        },
        [abort]
    );

    return { phase, text, error, status: phase === "streaming" ? status : null, run, abort, reset };
};
