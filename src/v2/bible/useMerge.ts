import { attemptPromise } from "@jfdi/attempt";
import { useState } from "react";
import { toast } from "react-toastify";
import { useDeleteLorebookMutation, useUpdateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import type { LorebookEntry } from "@/types/story";
import { useActionGeneration } from "../ai/useActionGeneration";
import { useAttempts } from "../ai/useAttempts";
import { type EntryProposal, parseEntryProposals } from "./parseProposals";

/**
 * Merging two of a story's own entries: the picks, every merge result (with
 * the writer's edits to it), and the save — which updates the kept entry and
 * only then deletes the duplicate.
 */
export const useMerge = (entries: LorebookEntry[], storyId: string, onMerged: () => void) => {
    const generation = useActionGeneration();
    const updateEntry = useUpdateLorebookMutation({ reportsOwnFailures: true });
    const deleteEntry = useDeleteLorebookMutation({ reportsOwnFailures: true });
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
    const results = useAttempts<EntryProposal>();
    const merged = results.current;
    const setMerged = results.edit;
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
        // A failed or stopped run still offers its merge if what arrived parses;
        // otherwise the error (if any) is on screen and earlier results stay
        if (result.outcome === "superseded" || !result.text.trim()) return;
        const [proposal] = parseEntryProposals(result.text);
        if (!proposal) {
            if (result.outcome === "complete") toast.error("The merge reply couldn't be read — try again");
            return;
        }
        // A different pair starts a fresh comparison; the same pair adds an attempt
        const samePair = mergedPair?.keepId === pair.keepId && mergedPair?.duplicateId === pair.duplicateId;
        setMergedPair(pair);
        if (!samePair) results.clear();
        results.record(proposal);
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
        onMerged();
    };

    const busy = generation.phase === "streaming";
    const setPicks = (keepPick: string, duplicatePick: string) => {
        setKeepId(keepPick);
        setDuplicateId(duplicatePick);
    };
    const nameOf = (id: string | undefined) => entries.find(e => e.id === id)?.name ?? "";

    return {
        generation,
        busy,
        keep,
        duplicate,
        pick,
        pickPair: (a: LorebookEntry, b: LorebookEntry) => setPicks(a.id, b.id),
        swap: () => setPicks(duplicateId, keepId),
        clearPicks: () => setPicks("", ""),
        /** What saving will change: the pair the shown result was made from. */
        savingOver: { keep: nameOf(mergedPair?.keepId), duplicate: nameOf(mergedPair?.duplicateId) },
        results,
        merged,
        setMerged,
        saving,
        run,
        save
    };
};
