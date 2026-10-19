import { attemptPromise } from "@jfdi/attempt";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useUpdateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import type { LorebookEntry } from "@/types/story";
import { useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";
import type { BibleFlowMode } from "./ExtractSheet";
import type { UpdateProposal } from "./parseProposals";
import { useAddProposals } from "./useAddProposals";
import { useFlowResults } from "./useFlowResults";
import { describeSweepFailures, useStorySweep } from "./useStorySweep";

const plural = (count: number) => `entr${count === 1 ? "y" : "ies"}`;

/**
 * A bible flow's work: run it (one chapter, the whole story, pasted text),
 * keep what it found for review, and write only what the writer approves.
 * Handed-in work (the nudge chip's names, pre-filled text) runs at once.
 */
export const useBibleFlow = ({
    mode,
    storyId,
    chapterId,
    entries,
    chapters,
    focusNames,
    initialText,
    onAdded
}: {
    mode: BibleFlowMode;
    storyId: string;
    chapterId: string | null;
    entries: LorebookEntry[];
    chapters: Array<{ id: string; title: string }>;
    focusNames: string[];
    initialText?: string;
    /** Everything ticked was added. */
    onAdded: () => void;
}) => {
    const generation = useActionGeneration();
    const addProposals = useAddProposals(storyId);
    const updateEntry = useUpdateLorebookMutation({ reportsOwnFailures: true });
    const [pasted, setPasted] = useState(initialText ?? "");
    const results = useFlowResults(entries);
    const { proposals, updates, issues, ticked } = results;
    const [approving, setApproving] = useState(false);
    const [sweepFailure, setSweepFailure] = useState<string | null>(null);
    const sweep = useStorySweep(storyId, chapters, generation);

    const run = async () => {
        if (mode === "extract-story") {
            const tally = { added: 0 };
            const swept = await sweep.run(found => {
                tally.added += results.addProposals(found);
            });
            const added = tally.added;
            setSweepFailure(describeSweepFailures(swept, chapters.length));
            if (!added && swept.failures.length === 0 && !sweep.wasStopped())
                toast.info(proposals?.length ? "Nothing new found" : "Nothing extractable found in any chapter");
            return;
        }
        const actionId =
            mode === "updates" ? "propose_updates" : mode === "continuity" ? "check_continuity" : "extract_entries";
        // Chapter modes read from the server — land any pending editor save first
        if (mode !== "extract-paste" && chapterId) await flushChapterSave(chapterId);
        const result = await generation.run({
            actionId,
            storyId,
            ...(mode !== "extract-paste" && chapterId ? { chapterId } : {}),
            editorContext: {
                ...(mode === "extract-paste" ? { userMessage: pasted } : {}),
                ...(focusNames.length > 0 && actionId === "extract_entries"
                    ? { guidance: `Extract entries ONLY for these newly appearing names: ${focusNames.join(", ")}` }
                    : {})
            }
        });
        // A failed or stopped run still offers whatever parses from what arrived —
        // a reply can be complete before its stream fails; the error stays on screen
        if (result.outcome === "superseded" || !result.text.trim()) return;
        const notice = results.offerReply(
            mode === "continuity" ? "issues" : mode === "updates" ? "updates" : "entries",
            result.text,
            result.outcome === "failed"
        );
        if (notice) toast.info(notice);
    };

    const approveEntries = async () => {
        if (approving) return;
        setApproving(true);
        const chosenIndexes = [...ticked].sort((a, b) => a - b);
        const landed = await addProposals(chosenIndexes.map(i => (proposals ?? [])[i]));
        const added = landed.filter(Boolean).length;
        const failed = landed.length - added;
        if (!failed) {
            toast.success(`${added} entr${added === 1 ? "y" : "ies"} added`);
            onAdded();
            return;
        }
        // Failures stay listed and ticked to retry — the list is paid-for work
        results.removeProposals(new Set(chosenIndexes.filter((_, n) => landed[n])));
        setApproving(false);
        toast.error(`${added} added, ${failed} couldn't be saved — they're still ticked here to try again`);
    };

    const applyUpdate = async (proposal: UpdateProposal) => {
        const entry = entries.find(e => e.name.toLowerCase() === proposal.name.toLowerCase());
        if (!entry) {
            toast.error(`No entry named “${proposal.name}”`);
            return;
        }
        // Removed from the list only once the write succeeds, so a failure
        // leaves the proposal available to retry
        const [error] = await attemptPromise(() =>
            updateEntry.mutateAsync({ id: entry.id, data: { description: proposal.updatedDescription } })
        );
        if (error) {
            toast.error(`Couldn't update “${proposal.name}”`);
            return;
        }
        results.removeUpdate(proposal);
    };

    // Handed-in work auto-runs: the nudge chip's names, or pre-filled text
    useEffect(() => {
        if (focusNames.length > 0 || initialText) void run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const busy = generation.phase === "streaming" || sweep.progress !== null;

    const found = proposals?.length ?? 0;
    const reviewable = found + (updates?.length ?? 0) + (issues?.length ?? 0);
    // What closing would throw away, as a question — null when nothing would be lost
    const closeQuestion = busy
        ? `This is still running. Close and lose ${found ? `the ${found} ${plural(found)} found so far` : "it"}?`
        : ticked.size > 0
          ? `Close without adding the ${ticked.size} ticked ${plural(ticked.size)} to the bible?`
          : reviewable > 0
            ? "Close and discard these results? Getting them again means running it again."
            : null;

    return {
        generation,
        sweep,
        results,
        pasted,
        setPasted,
        approving,
        sweepFailure,
        busy,
        closeQuestion,
        run,
        approveEntries,
        applyUpdate
    };
};
