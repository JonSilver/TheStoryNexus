import { attemptPromise } from "@jfdi/attempt";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useDeleteLorebookMutation, useUpdateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import type { LorebookEntry } from "@/types/story";
import { useActionGeneration } from "../ai/useActionGeneration";
import { MergePicker } from "./MergePicker";
import { type EntryProposal, parseEntryProposals } from "./parseProposals";

/**
 * AI-assisted de-duplication: pick the entry to KEEP and the duplicate to
 * fold into it; the merge action combines every distinct fact and unions
 * aliases; the result is reviewed (and editable) before anything is
 * written. Saving updates the kept entry and deletes the duplicate.
 */
export const MergeSheet = ({ entries, onClose }: { entries: LorebookEntry[]; onClose: () => void }) => {
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
    const [merged, setMerged] = useState<EntryProposal | null>(null);
    const [saving, setSaving] = useState(false);

    const keep = entries.find(e => e.id === keepId);
    const duplicate = entries.find(e => e.id === duplicateId);
    const storyId = keep?.level === "story" ? keep.scopeId : undefined;

    const run = async () => {
        if (!keep || !duplicate) return;
        const describe = (e: LorebookEntry) =>
            JSON.stringify({ name: e.name, category: e.category, description: e.description, tags: e.tags ?? [] });
        const text = await generation.run({
            actionId: "merge_entries",
            storyId: storyId ?? keep.scopeId ?? "",
            editorContext: {
                userMessage: `Entry A (keep):\n${describe(keep)}\n\nEntry B (duplicate):\n${describe(duplicate)}`
            }
        });
        const [proposal] = parseEntryProposals(text);
        if (!proposal) {
            toast.error("The merge reply couldn't be read — try again");
            return;
        }
        setMerged(proposal);
    };

    const save = async () => {
        if (!merged || !keep || !duplicate || saving) return;
        setSaving(true);
        const [error] = await attemptPromise(() =>
            updateEntry.mutateAsync({
                id: keep.id,
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
        const [deleteError] = await attemptPromise(() => deleteEntry.mutateAsync(duplicate.id));
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
                            {busy && (
                                <p className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Merging…
                                </p>
                            )}
                            {generation.error && <p className="text-destructive">{generation.error}</p>}
                        </>
                    ) : (
                        <>
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
                                Saving updates “{keep?.name}” and deletes “{duplicate?.name}”.
                            </p>
                        </>
                    )}
                </div>
                <footer className="flex gap-2 border-t p-3">
                    {!merged ? (
                        <button
                            type="button"
                            onClick={() => void run()}
                            disabled={!keep || !duplicate || busy}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            {busy ? "Merging…" : "Merge with AI"}
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
                    <button type="button" onClick={onClose} className="ml-auto rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </footer>
            </div>
        </div>
    );
};
