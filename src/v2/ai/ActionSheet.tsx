import { CornerDownRight, Loader2, Square } from "lucide-react";
import { useState } from "react";
import type { GenerationStatus } from "@/services/ai/sseParser";
import { GenerationProgress } from "./GenerationProgress";
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
    status = null,
    acceptLabel = "Accept",
    onAccept,
    onDiscard,
    onStop,
    onRefine,
    inputRequest
}: {
    title: string;
    phase: GenerationPhase;
    text: string;
    error: string | null;
    status?: GenerationStatus | null;
    acceptLabel?: string;
    onAccept: () => void;
    onDiscard: () => void;
    onStop: () => void;
    onRefine?: (guidance: string) => void;
    inputRequest?: { placeholder: string; onSubmit: (value: string) => void } | null;
}) => {
    const [draft, setDraft] = useState("");
    const [refineText, setRefineText] = useState("");
    if (phase === "idle" && !inputRequest) return null;

    const submitDraft = () => {
        if (!draft.trim() || !inputRequest) return;
        inputRequest.onSubmit(draft.trim());
        setDraft("");
    };
    const submitRefine = () => {
        if (!refineText.trim() || !onRefine) return;
        onRefine(refineText.trim());
        setRefineText("");
    };
    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-label={title}>
            <div className="flex max-h-[75dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center gap-2 px-4 py-3">
                    <span className="font-medium">{title}</span>
                    {phase === "streaming" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </header>
                <div className="min-h-[8rem] flex-1 overflow-y-auto whitespace-pre-wrap px-4 pb-3 text-sm leading-relaxed">
                    {phase === "idle" && inputRequest ? (
                        <textarea
                            className="min-h-24 w-full resize-y rounded-md border bg-background p-2"
                            placeholder={inputRequest.placeholder}
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    submitDraft();
                                }
                            }}
                        />
                    ) : error ? (
                        <span className="text-destructive">{error}</span>
                    ) : text ? (
                        text
                    ) : (
                        <GenerationProgress status={status} />
                    )}
                </div>
                {phase === "done" && text && onRefine && (
                    <div className="flex gap-2 px-3 pb-2">
                        <input
                            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                            maxLength={5000}
                            placeholder="Refine: e.g. darker, tighter, less dialogue…"
                            value={refineText}
                            onChange={e => setRefineText(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && submitRefine()}
                        />
                        <button
                            type="button"
                            onClick={submitRefine}
                            disabled={!refineText.trim()}
                            className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                        >
                            <CornerDownRight className="h-4 w-4" /> Refine
                        </button>
                    </div>
                )}
                <footer className="flex gap-2 border-t p-3">
                    {phase === "idle" && inputRequest ? (
                        <button
                            type="button"
                            onClick={submitDraft}
                            disabled={!draft.trim()}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            Go
                        </button>
                    ) : phase === "streaming" ? (
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
