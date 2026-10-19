import { Loader2 } from "lucide-react";
import type { GenerationStatus } from "@/services/ai/sseParser";

const PHASE_LABEL: Record<GenerationStatus["phase"], string> = {
    waiting: "Waiting for the model server to respond",
    thinking: "The model is working on it",
    streaming: "Writing"
};

const elapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

const STALL_NOTICE_MS = 10_000;

/**
 * The one waiting indicator every AI surface uses: says which phase the
 * request is in and how long it's been, so the writer is never left
 * guessing whether anything is happening. Hidden while text is flowing —
 * and back, as a stall notice, when it stops flowing mid-stream.
 */
export const GenerationProgress = ({
    status,
    className = "",
    stopNote = "Stop keeps what has arrived."
}: {
    status: GenerationStatus | null;
    className?: string;
    /** What Stop does here, said in the stall notice — surfaces differ in what they can keep. */
    stopNote?: string;
}) => {
    if (!status) return null;
    if (status.phase === "streaming") {
        if ((status.idleMs ?? 0) < STALL_NOTICE_MS) return null;
        return (
            <span role="status" aria-live="polite" className={`block text-xs text-muted-foreground ${className}`}>
                No new text for {elapsed(status.idleMs ?? 0)} — the model may have stalled. {stopNote}
            </span>
        );
    }
    const slow = status.elapsedMs >= 20_000;
    return (
        <span
            role="status"
            aria-live="polite"
            className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}
        >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span>
                {PHASE_LABEL[status.phase]}… {elapsed(status.elapsedMs)}
                {slow && status.phase === "waiting" && (
                    <span className="block text-xs">
                        Slow starts usually mean the server is loading the model or busy. You can stop at any time.
                    </span>
                )}
            </span>
        </span>
    );
};
