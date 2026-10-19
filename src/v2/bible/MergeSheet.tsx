import { attemptPromise } from "@jfdi/attempt";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useDeleteLorebookMutation, useUpdateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import type { LorebookEntry } from "@/types/story";
import { AttemptNav } from "../ai/AttemptNav";
import { GenerationProgress } from "../ai/GenerationProgress";
import { useActionGeneration } from "../ai/useActionGeneration";
import { MergePicker } from "./MergePicker";
import { type EntryProposal, parseEntryProposals } from "./parseProposals";

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
    const generation = useActionGeneration();
    const updateEntry = useUpdateLorebookMutation();
    const deleteEntry = useDeleteLorebookMutation();
    const [keepId, setKeepId] = useState("");
    const [duplicateId, setDuplicateId] = useState("");

    // First tap fills Keep, second fills Duplicate; tapping a pick unpicks it
    const pick = (entry: LorebookEntry) => {
        if (entry.id === keepId) return (setKeepId(duplicateId ? duplicateId : ""), setDuplicateId(""));
        if (entry.id === duplicateId) return setDuplicateId("");
        if (!keepId) return setKeepId(entry.id);
        setDuplicateId(entry.id);
    };
    // Every merge result is kept, with the writer's edits to it — Try again
    // adds another to compare, never replaces one
    const [results, setResults] = useState<{ list: EntryProposal[]; shown: number }>({ list: [], shown: 0 });
    const merged = results.list[results.shown] ?? null;
    const setMerged = (next: EntryProposal) =>
        setResults(prev => ({ ...prev, list: prev.list.map((r, i) => (i === prev.shown ? next : r)) }));
    // The pair the AI actually merged — fixed at run time, so changing the
    // picks mid-generation can never apply A+B's result to C and delete D
    const [mergedPair, setMergedPair] = useState<{ keepId: string; duplicateId: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const keep = entries.find(e => e.id === keepId);
    const duplicate = entries.find(e => e.id === duplicateId);

    const run = async () => {
        if (!keep || !duplicate) return;
        const pair = { keepId: keep.id, duplicateId: duplicate.id };
        const describe = (e: LorebookEntry) =>
            JSON.stringify({ name: e.name, category: e.category, description: e.description, tags: e.tags ?? [] });
        const result = await generation.run({
            actionId: "merge_entries",
            storyId,
            editorContext: {
                userMessage: `Entry A (keep):\n${describe(keep)}\n\nEntry B (duplicate):\n${describe(duplicate)}`
            }
        });
        // Failed or stopped: the error (if any) is on screen, earlier results stay
        if (result.outcome !== "complete") return;
        const [proposal] = parseEntryProposals(result.text);
        if (!proposal) {
            toast.error("The merge reply couldn't be read — try again");
            return;
        }
        // A different pair starts a fresh comparison; the same pair adds an attempt
        const samePair = mergedPair?.keepId === pair.keepId && mergedPair?.duplicateId === pair.duplicateId;
        setMergedPair(pair);
        setResults(prev =>
            samePair ? { list: [...prev.list, proposal], shown: prev.list.length } : { list: [proposal], shown: 0 }
        );
    };

    const save = async () => {
        const target = entries.find(e => e.id === mergedPair?.keepId);
        const folded = entries.find(e => e.id === mergedPair?.duplicateId);
        if (!merged || !target || !folded || saving) return;
        setSaving(true);
        const [error] = await attemptPromise(() =>
            updateEntry.mutateAsync({
                id: target.id,
                data: {
                    name: merged.name,
                    description: merged.description,
                    tags: merged.tags,
                    category: merged.category as LorebookEntry["category"]
                }
            })
        );
        if (error) {
            setSaving(false);
            toast.error("Couldn't save the merged entry — nothing was deleted");
            return;
        }
        // Await completion BEFORE closing: unmounting mid-mutation skips the
        // cache invalidation and leaves a ghost of the deleted duplicate on screen
        const [deleteError] = await attemptPromise(() => deleteEntry.mutateAsync(folded.id));
        if (deleteError) {
            setSaving(false);
            toast.error("Merged entry saved, but the duplicate couldn't be deleted — remove it manually");
            return;
        }
        toast.success(`Merged into “${merged.name}”`);
        onClose();
    };

    const busy = generation.phase === "streaming";

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
            role="dialog"
            aria-label="Merge entries"
        >
            <div className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">Merge duplicate entries</span>
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="space-y-2 overflow-y-auto px-4 pb-4 text-sm">
                    {!merged ? (
                        <>
                            {inheritedCount > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {inheritedCount} series/global entr{inheritedCount === 1 ? "y is" : "ies are"}{" "}
                                    shared with other stories and can't be merged from here.
                                </p>
                            )}
                            <fieldset disabled={busy} className="contents">
                                <MergePicker
                                    entries={entries}
                                    keep={keep ?? null}
                                    duplicate={duplicate ?? null}
                                    onPick={pick}
                                    onPickPair={(a, b) => {
                                        setKeepId(a.id);
                                        setDuplicateId(b.id);
                                    }}
                                    onSwap={() => {
                                        setKeepId(duplicateId);
                                        setDuplicateId(keepId);
                                    }}
                                    onClear={() => {
                                        setKeepId("");
                                        setDuplicateId("");
                                    }}
                                />
                            </fieldset>
                            {busy && <GenerationProgress status={generation.status} />}
                            {generation.error && <p className="text-destructive">{generation.error}</p>}
                        </>
                    ) : (
                        <>
                            {busy && <GenerationProgress status={generation.status} />}
                            {generation.error && !busy && (
                                <p className="text-destructive">
                                    {generation.error} The previous merge result is still below.
                                </p>
                            )}
                            {results.list.length > 1 && (
                                <AttemptNav
                                    label="Merge"
                                    index={results.shown}
                                    count={results.list.length}
                                    onSelect={shown => setResults(prev => ({ ...prev, shown }))}
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
                                Saving updates “{entries.find(e => e.id === mergedPair?.keepId)?.name}” and deletes “
                                {entries.find(e => e.id === mergedPair?.duplicateId)?.name}”.
                            </p>
                        </>
                    )}
                </div>
                <footer className="flex gap-2 border-t p-3">
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
                    <button type="button" onClick={onClose} className="ml-auto rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </footer>
            </div>
        </div>
    );
};
