import { Loader2, Square } from "lucide-react";
import type { GenerationPhase } from "./useActionGeneration";

/**
 * Bottom sheet showing a streaming generation with explicit Accept/Discard —
 * generated text NEVER lands in the document without an accept (contracts
 * Phase 4: no overwriting selections directly).
 */
export const ActionSheet = ({
    title,
    phase,
    text,
    error,
    acceptLabel = "Accept",
    onAccept,
    onDiscard,
    onStop
}: {
    title: string;
    phase: GenerationPhase;
    text: string;
    error: string | null;
    acceptLabel?: string;
    onAccept: () => void;
    onDiscard: () => void;
    onStop: () => void;
}) => {
    if (phase === "idle") return null;
    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-label={title}>
            <div className="flex max-h-[75dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center gap-2 px-4 py-3">
                    <span className="font-medium">{title}</span>
                    {phase === "streaming" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </header>
                <div className="min-h-[8rem] flex-1 overflow-y-auto whitespace-pre-wrap px-4 pb-3 text-sm leading-relaxed">
                    {error ? <span className="text-destructive">{error}</span> : text || "…"}
                </div>
                <footer className="flex gap-2 border-t p-3">
                    {phase === "streaming" ? (
                        <button
                            type="button"
                            onClick={onStop}
                            className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
                        >
                            <Square className="h-3.5 w-3.5" /> Stop
                        </button>
                    ) : (
                        <>
                            {phase === "done" && text && (
                                <button
                                    type="button"
                                    onClick={onAccept}
                                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                                >
                                    {acceptLabel}
                                </button>
                            )}
                            <button type="button" onClick={onDiscard} className="rounded-md border px-4 py-2 text-sm">
                                Discard
                            </button>
                        </>
                    )}
                </footer>
            </div>
        </div>
    );
};
