import { ChevronLeft, ChevronRight, CornerDownRight, Trash2 } from "lucide-react";
import { useState } from "react";

/**
 * Multi-take viewer: every generation is kept; the writer browses ‹ i/n ›,
 * deletes duds, accepts the take they like — and can accept more than one
 * to cherry-pick paragraphs in the prose itself, where editing belongs.
 */
export const TakeViewer = ({
    takes,
    activeTake,
    incompleteTakes = [],
    onSelect,
    onDelete,
    onAccept,
    onRefine
}: {
    takes: string[];
    activeTake: number;
    /** Takes cut short by a failure. */
    incompleteTakes?: number[];
    onSelect: (index: number) => void;
    onDelete: (index: number) => void;
    onAccept: (removeBeat: boolean) => void;
    onRefine: (guidance: string) => void;
}) => {
    const [refineText, setRefineText] = useState("");
    if (takes.length === 0) return null;
    const current = Math.min(activeTake, takes.length - 1);

    const refine = () => {
        if (!refineText.trim()) return;
        onRefine(refineText.trim());
        setRefineText("");
    };

    return (
        <div className="space-y-2">
            <div className="whitespace-pre-wrap rounded-md border bg-background/60 p-2 select-text">
                {incompleteTakes.includes(current) && (
                    <p className="mb-1 text-xs text-muted-foreground">
                        Incomplete — the model stopped partway through.
                    </p>
                )}
                {takes[current]}
            </div>
            <div className="flex items-center gap-2">
                {takes.length > 1 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <button
                            type="button"
                            onClick={() => onSelect(Math.max(current - 1, 0))}
                            disabled={current === 0}
                            aria-label="Previous take"
                            className="disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        take {current + 1}/{takes.length}
                        <button
                            type="button"
                            onClick={() => onSelect(Math.min(current + 1, takes.length - 1))}
                            disabled={current === takes.length - 1}
                            aria-label="Next take"
                            className="disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => onAccept(false)}
                    className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                >
                    Accept
                </button>
                <button
                    type="button"
                    onClick={() => onAccept(true)}
                    title="Accept and remove the beat from the prose"
                    className="rounded-md border px-3 py-1 text-sm"
                >
                    Accept &amp; tidy
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(current)}
                    aria-label="Delete this take"
                    className="ml-auto text-muted-foreground"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
            <div className="flex gap-2">
                <input
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm"
                    maxLength={5000}
                    placeholder="Refine: e.g. darker, tighter, from her POV…"
                    value={refineText}
                    onChange={e => setRefineText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && refine()}
                />
                <button
                    type="button"
                    onClick={refine}
                    disabled={!refineText.trim()}
                    aria-label="Regenerate with this steer"
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm disabled:opacity-50"
                >
                    <CornerDownRight className="h-4 w-4" /> Refine
                </button>
            </div>
        </div>
    );
};
