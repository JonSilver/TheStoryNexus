import type { LorebookEntry } from "@/types/story";
import { AttemptNav } from "../ai/AttemptNav";
import { GenerationProgress } from "../ai/GenerationProgress";
import { BottomSheet } from "../components/BottomSheet";
import { useConfirm } from "../components/Dialogs";
import { BIBLE_STOP_NOTE } from "./FlowResults";
import { MergePicker } from "./MergePicker";
import { useMerge } from "./useMerge";

/**
 * AI-assisted de-duplication: pick the entry to KEEP and the duplicate to
 * fold into it; the merge action combines every distinct fact and unions
 * aliases; the result is reviewed (and editable) before anything is
 * written. Saving updates the kept entry and deletes the duplicate.
 */
export const MergeSheet = ({
    entries: allEntries,
    storyId,
    onClose
}: {
    entries: LorebookEntry[];
    storyId: string;
    onClose: () => void;
}) => {
    // Series and global entries are shared canon across stories — merging
    // from one story must never rewrite or delete them for the others
    const entries = allEntries.filter(e => e.level === "story" && e.scopeId === storyId);
    const inheritedCount = allEntries.length - entries.length;
    const confirm = useConfirm();
    const merge = useMerge(entries, storyId, onClose);
    const { generation, busy, keep, duplicate, pick, results, merged, setMerged, saving, run, save } = merge;

    // A merge result (and any edits to it) is paid-for work: closing asks first
    const close = async () => {
        if (
            (busy || merged) &&
            !(await confirm({ message: "Close and discard the merge result?", confirmLabel: "Close" }))
        )
            return;
        onClose();
    };

    return (
        <BottomSheet
            title="Merge duplicate entries"
            onClose={close}
            bodyClassName="space-y-2 px-4 pb-4 text-sm"
            footer={
                <>
                    {busy ? (
                        <button
                            type="button"
                            onClick={generation.abort}
                            className="rounded-md border px-4 py-2 text-sm"
                        >
                            Stop
                        </button>
                    ) : !merged ? (
                        <button
                            type="button"
                            onClick={() => void run()}
                            disabled={!keep || !duplicate || busy}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            {busy ? "Merging…" : generation.error ? "Try again" : "Merge with AI"}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={saving || !merged.name.trim()}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            Save merged entry
                        </button>
                    )}
                    {merged && !busy && (
                        <button
                            type="button"
                            onClick={() => void run()}
                            disabled={saving}
                            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        >
                            Try again
                        </button>
                    )}
                    <button type="button" onClick={close} className="ml-auto rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </>
            }
        >
            {!merged ? (
                <>
                    {inheritedCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {inheritedCount} series/global entr{inheritedCount === 1 ? "y is" : "ies are"} shared with
                            other stories and can't be merged from here.
                        </p>
                    )}
                    <fieldset disabled={busy} className="contents">
                        <MergePicker
                            entries={entries}
                            keep={keep ?? null}
                            duplicate={duplicate ?? null}
                            onPick={pick}
                            onPickPair={merge.pickPair}
                            onSwap={merge.swap}
                            onClear={merge.clearPicks}
                        />
                    </fieldset>
                    {busy && <GenerationProgress status={generation.status} stopNote={BIBLE_STOP_NOTE} />}
                    {generation.error && <p className="text-destructive">{generation.error}</p>}
                </>
            ) : (
                <>
                    {busy && <GenerationProgress status={generation.status} stopNote={BIBLE_STOP_NOTE} />}
                    {generation.error && !busy && (
                        <p className="text-destructive">{generation.error} The previous merge result is still below.</p>
                    )}
                    {results.count > 1 && (
                        <AttemptNav
                            label="Merge"
                            index={results.index}
                            count={results.count}
                            onSelect={results.select}
                            disabled={busy}
                            className="flex items-center justify-center gap-3 text-sm"
                        />
                    )}
                    <input
                        className="w-full rounded-md border bg-background px-3 py-2"
                        aria-label="Merged name"
                        value={merged.name}
                        onChange={e => setMerged({ ...merged, name: e.target.value })}
                    />
                    <textarea
                        className="min-h-28 w-full resize-y rounded-md border bg-background p-2"
                        aria-label="Merged description"
                        value={merged.description}
                        onChange={e => setMerged({ ...merged, description: e.target.value })}
                    />
                    <input
                        className="w-full rounded-md border bg-background px-3 py-2"
                        aria-label="Merged tags"
                        value={merged.tags.join(", ")}
                        onChange={e =>
                            setMerged({
                                ...merged,
                                tags: e.target.value
                                    .split(",")
                                    .map(t => t.trim())
                                    .filter(Boolean)
                            })
                        }
                    />
                    <p className="text-xs text-muted-foreground">
                        Saving updates “{merge.savingOver.keep}” and deletes “{merge.savingOver.duplicate}”.
                    </p>
                </>
            )}
        </BottomSheet>
    );
};
