import { Trash2 } from "lucide-react";
import { AttemptNav } from "../../ai/AttemptNav";
import { RefineInput } from "../../ai/RefineInput";

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
    if (takes.length === 0) return null;
    const current = Math.min(activeTake, takes.length - 1);

    return (
        <div className="space-y-2">
            <div className="whitespace-pre-wrap rounded-md border bg-background/60 p-2 select-text">
                {incompleteTakes.includes(current) && (
                    <p className="mb-1 text-xs text-muted-foreground">Incomplete — cut short before the end.</p>
                )}
                {takes[current]}
            </div>
            <div className="flex items-center gap-2">
                {takes.length > 1 && (
                    <AttemptNav
                        label="Take"
                        index={current}
                        count={takes.length}
                        onSelect={index => onSelect(Math.max(0, Math.min(index, takes.length - 1)))}
                        className="flex items-center gap-2 text-xs"
                    />
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
            <RefineInput onRefine={onRefine} placeholder="Refine: e.g. darker, tighter, from her POV…" />
        </div>
    );
};
