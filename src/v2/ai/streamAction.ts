import type { GenerationStatus } from "@/services/ai/sseParser";
import { abortGeneration, streamGeneration } from "@/services/api/generation";
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
    /** Exactly once: error is undefined for success/stop (partial tokens already delivered). */
    onDone: (error?: string) => void;
}

/** A fire-and-forget generation for callers that own their own state (ghosts, background summaries). */
export const streamAction = (request: StreamActionRequest, handlers: StreamActionHandlers) => {
    const requestId = randomUUID();
    const controller = new AbortController();
    void streamGeneration(
        { requestId, ...request },
        { signal: controller.signal, onStatus: handlers.onStatus, onToken: handlers.onToken }
    ).then(result => handlers.onDone(result.end === "failed" ? result.error : undefined));
    return {
        abort: () => {
            controller.abort();
            abortGeneration(requestId);
        }
    };
};
