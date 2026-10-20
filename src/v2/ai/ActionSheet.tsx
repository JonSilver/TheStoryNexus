import { Loader2, RotateCcw, Square } from "lucide-react";
import { useState } from "react";
import type { GenerationStatus } from "@/services/ai/sseParser";
import { BottomSheet } from "../components/BottomSheet";
import { AttemptNav } from "./AttemptNav";
import { GenerationProgress } from "./GenerationProgress";
import { RefineInput } from "./RefineInput";
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
    attemptIndex = 0,
    attemptCount = 0,
    attemptPartial = false,
    suspect = null,
    onSelectAttempt,
    onAgain,
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
    /** Earlier results are kept; the writer can flip between them. */
    attemptIndex?: number;
    attemptCount?: number;
    /** The attempt shown was cut short by a failure. */
    attemptPartial?: boolean;
    /** The shown reply looks like more than the passage: why, and how to keep just the passage's length. */
    suspect?: { concerns: string[]; keepPassage?: { paragraphs: number; keep: () => void } } | null;
    onSelectAttempt?: (index: number) => void;
    /** Run the same request again — after a failure or an unusable result. */
    onAgain?: () => void;
    acceptLabel?: string;
    onAccept: () => void;
    onDiscard: () => void;
    onStop: () => void;
    onRefine?: (guidance: string) => void;
    inputRequest?: { placeholder: string; onSubmit: (value: string) => void } | null;
}) => {
    const [draft, setDraft] = useState("");

    const submitDraft = () => {
        if (!draft.trim() || !inputRequest) return;
        inputRequest.onSubmit(draft.trim());
        setDraft("");
    };
    return (
        <BottomSheet
            title={title}
            onClose={onDiscard}
            headerExtra={phase === "streaming" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            bodyClassName=""
            footer={
                <>
                    {phase === "idle" && inputRequest ? (
                        <>
                            <button
                                type="button"
                                onClick={submitDraft}
                                disabled={!draft.trim()}
                                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                            >
                                Go
                            </button>
                            <button
                                type="button"
                                onClick={onDiscard}
                                className="ml-auto rounded-md border px-4 py-2 text-sm"
                            >
                                Cancel
                            </button>
                        </>
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
                            {text && (
                                <button
                                    type="button"
                                    onClick={onAccept}
                                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                                >
                                    {acceptLabel}
                                </button>
                            )}
                            {onAgain && (
                                <button
                                    type="button"
                                    onClick={onAgain}
                                    className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Try again
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onDiscard}
                                className="ml-auto rounded-md border px-4 py-2 text-sm"
                            >
                                Discard
                            </button>
                        </>
                    )}
                </>
            }
        >
            <div className="min-h-[8rem] whitespace-pre-wrap px-4 pb-3 text-sm leading-relaxed">
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
                ) : phase === "idle" ? (
                    // Opened, not yet sent (a save is landing first): Discard here costs nothing
                    <GenerationProgress status={{ phase: "waiting", elapsedMs: 0 }} />
                ) : phase === "streaming" ? (
                    <>
                        {text}
                        <GenerationProgress status={status} className={text ? "mt-2" : ""} />
                    </>
                ) : (
                    <>
                        {error && (
                            <p className="mb-2 text-destructive">
                                {error}
                                {attemptCount > 0 &&
                                    (attemptPartial
                                        ? " What arrived is below."
                                        : " Your earlier result is still here.")}
                            </p>
                        )}
                        {text && suspect && (
                            <div
                                role="alert"
                                className="mb-2 space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs whitespace-normal"
                            >
                                <p>
                                    This may be more than your passage — {suspect.concerns.join("; ")}. Check it before
                                    you use it.
                                </p>
                                {suspect.keepPassage && (
                                    <button
                                        type="button"
                                        onClick={suspect.keepPassage.keep}
                                        className="rounded-md border bg-background px-2 py-1"
                                    >
                                        Keep only the first{" "}
                                        {suspect.keepPassage.paragraphs === 1
                                            ? "paragraph"
                                            : `${suspect.keepPassage.paragraphs} paragraphs`}
                                    </button>
                                )}
                            </div>
                        )}
                        {text && attemptPartial && (
                            <p className="mb-1 text-xs text-muted-foreground">Incomplete — cut short before the end.</p>
                        )}
                        {text}
                    </>
                )}
            </div>
            {phase !== "streaming" && attemptCount > 1 && onSelectAttempt && (
                <AttemptNav label="Attempt" index={attemptIndex} count={attemptCount} onSelect={onSelectAttempt} />
            )}
            {phase !== "streaming" && text && onRefine && (
                <RefineInput onRefine={onRefine} className="flex gap-2 px-3 pb-2" />
            )}
        </BottomSheet>
    );
};
