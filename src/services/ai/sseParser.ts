/**
 * Incremental parser for the server's generation SSE stream
 * (event: status | token | error | finish | aborted). Buffers across chunk
 * boundaries, tolerates CRLF, and treats stream end without a terminal
 * frame as an error — truncated output must never pass as success.
 */
export type GenerationPhase = "waiting" | "thinking" | "streaming";

export interface GenerationStatus {
    phase: GenerationPhase;
    elapsedMs: number;
    /** While streaming: time since text last arrived. */
    idleMs?: number;
}

export interface SSEHandlers {
    /** Heartbeat while waiting on the provider — which phase, and for how long. */
    onStatus?: (status: GenerationStatus) => void;
    onToken: (text: string) => void;
    onComplete: () => void;
    /** The server confirmed a Stop; defaults to onComplete for callers that don't distinguish. */
    onAborted?: () => void;
    onError: (error: Error) => void;
}

export interface SSEParser {
    push: (chunk: string) => void;
    end: () => void;
}

export const createSSEParser = ({ onStatus, onToken, onComplete, onAborted, onError }: SSEHandlers): SSEParser => {
    const state = { buffer: "", terminated: false };

    const dispatchFrame = (frame: string): void => {
        if (state.terminated) return;
        const eventMatch = frame.match(/^event: (.+?)\r?$/m);
        const dataMatch = frame.match(/^data: (.+?)\r?$/m);
        if (!eventMatch) return;

        const data = (() => {
            if (!dataMatch) return {};
            try {
                return JSON.parse(dataMatch[1]);
            } catch {
                return null;
            }
        })();
        if (data === null) return;

        switch (eventMatch[1]) {
            case "status":
                if (data?.phase)
                    onStatus?.({
                        phase: data.phase,
                        elapsedMs: Number(data.elapsedMs) || 0,
                        ...(typeof data.idleMs === "number" && { idleMs: data.idleMs })
                    });
                return;
            case "token":
                if (data?.text) onToken(data.text);
                return;
            case "error":
                state.terminated = true;
                onError(new Error(data?.message || "Generation failed"));
                return;
            case "finish":
                state.terminated = true;
                onComplete();
                return;
            case "aborted":
                state.terminated = true;
                (onAborted ?? onComplete)();
                return;
            default:
                return;
        }
    };

    return {
        push: (chunk: string) => {
            if (state.terminated) return;
            state.buffer += chunk;
            const frames = state.buffer.split(/\r?\n\r?\n/);
            state.buffer = frames.pop() ?? "";
            frames.forEach(dispatchFrame);
        },
        end: () => {
            if (state.terminated) return;
            if (state.buffer.trim()) dispatchFrame(state.buffer);
            if (!state.terminated) onError(new Error("Generation stream ended unexpectedly"));
        }
    };
};
