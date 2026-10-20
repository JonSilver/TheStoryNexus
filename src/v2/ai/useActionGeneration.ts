import { useCallback, useEffect, useRef, useState } from "react";
import type { GenerationStatus } from "@/services/ai/sseParser";
import { abortGeneration, streamGeneration } from "@/services/api/generation";
import type { ActionEditorContext, ActionId, AnsweredModel } from "@/types/actions";
import { randomUUID } from "@/utils/crypto";

export type { ActionEditorContext, ActionId };

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
    /** The model that answered, when the server said. */
    model?: AnsweredModel;
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
    const [model, setModel] = useState<AnsweredModel | null>(null);
    const active = useRef<{ requestId: string; controller: AbortController } | null>(null);

    const unmounted = useRef(false);
    const frame = useRef(0);
    // Abort any in-flight generation when the owning component unmounts
    useEffect(
        () => () => {
            unmounted.current = true;
            cancelAnimationFrame(frame.current);
            active.current?.controller.abort();
            active.current = null;
        },
        []
    );

    const abort = useCallback(() => {
        const current = active.current;
        if (!current) return;
        current.controller.abort();
        abortGeneration(current.requestId);
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
            abortGeneration(current.requestId);
        }
        setPhase("idle");
        setText("");
        setError(null);
        setStatus(null);
        setModel(null);
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
            setModel(null);

            const chunks: string[] = [];
            const answered: { model?: AnsweredModel } = {};
            // Only the request that still owns `active` may touch state —
            // a superseded run's late callbacks must not clobber its successor
            const owns = () => active.current?.requestId === requestId;

            const ended = await streamGeneration(
                { requestId, ...request },
                {
                    signal: controller.signal,
                    onModel: next => {
                        answered.model = next;
                        if (owns()) setModel(next);
                    },
                    onStatus: next => {
                        if (owns()) setStatus(next);
                    },
                    onToken: token => {
                        if (!owns()) return;
                        chunks.push(token);
                        // One render per frame, not per token (joining per token was quadratic too)
                        if (frame.current) return;
                        frame.current = requestAnimationFrame(() => {
                            frame.current = 0;
                            if (owns()) setText(chunks.join(""));
                        });
                    }
                }
            );
            const text = chunks.join("");
            cancelAnimationFrame(frame.current);
            frame.current = 0;
            if (owns()) setText(text);

            // Left mid-stream (the screen closed): what arrived is still the writer's — callers
            // that persist (Brainstorm) keep it; no state is touched on the unmounted hook
            if (!owns())
                return unmounted.current && text
                    ? { text, outcome: "stopped", model: answered.model }
                    : { text: "", outcome: "superseded" };
            active.current = null;
            if (ended.end === "failed") {
                // A failure keeps whatever text arrived first — callers decide how to offer it
                setPhase("error");
                setError(ended.error);
                return { text, outcome: "failed", error: ended.error, model: answered.model };
            }
            // Stopped mid-stream: what arrived is the writer's to accept or discard
            setPhase("done");
            return { text, outcome: ended.end === "complete" ? "complete" : "stopped", model: answered.model };
        },
        [abort]
    );

    return { phase, text, error, status: phase === "streaming" ? status : null, model, run, abort, reset };
};
