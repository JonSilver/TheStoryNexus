import { attemptPromise } from "@jfdi/attempt";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useUpdateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import type { LorebookEntry } from "@/types/story";
import { GenerationProgress } from "../ai/GenerationProgress";
import { useActionGeneration } from "../ai/useActionGeneration";
import { BottomSheet } from "../components/BottomSheet";
import { useConfirm } from "../components/Dialogs";
import { flushChapterSave } from "../editor/useChapterSaver";
import { BIBLE_STOP_NOTE } from "./FlowResults";
import { FLOW_TITLES, IssueList, ProposalList, UpdateList } from "./FlowResults";
import type { UpdateProposal } from "./parseProposals";
import { useAddProposals } from "./useAddProposals";
import { useFlowResults } from "./useFlowResults";
import { describeSweepFailures, useStorySweep } from "./useStorySweep";

export type BibleFlowMode = "extract-chapter" | "extract-story" | "extract-paste" | "updates" | "continuity";

/**
 * Review-before-save flow (contracts Phase 6): nothing the model proposes
 * is written to the bible without explicit approval.
 */
export const ExtractSheet = ({
    mode,
    storyId,
    chapterId,
    entries,
    chapters = [],
    focusNames = [],
    initialText,
    onClose
}: {
    mode: BibleFlowMode;
    storyId: string;
    chapterId: string | null;
    entries: LorebookEntry[];
    /** Ordered chapters, for the whole-story sweep. */
    chapters?: Array<{ id: string; title: string }>;
    /** Names from the editor's nudge chip: focuses the extraction and auto-runs it. */
    focusNames?: string[];
    /** Pre-filled text for extract-paste (e.g. a brainstorm reply) — auto-runs. */
    initialText?: string;
    onClose: () => void;
}) => {
    const generation = useActionGeneration();
    const confirm = useConfirm();
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

    // Found-but-unadded entries are paid-for work: closing asks before discarding them
    const close = async () => {
        const found = proposals?.length ?? 0;
        const reviewable = found + (updates?.length ?? 0) + (issues?.length ?? 0);
        const question = busy
            ? `This is still running. Close and lose ${found ? `the ${found} entr${found === 1 ? "y" : "ies"} found so far` : "it"}?`
            : ticked.size > 0
              ? `Close without adding the ${ticked.size} ticked entr${ticked.size === 1 ? "y" : "ies"} to the bible?`
              : reviewable > 0
                ? "Close and discard these results? Getting them again means running it again."
                : null;
        if (question && !(await confirm({ message: question, confirmLabel: "Close" }))) return;
        onClose();
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
            onClose();
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
    const chapterLabel =
        mode === "extract-chapter" || mode === "updates" || mode === "continuity"
            ? (chapters.find(c => c.id === chapterId)?.title ?? null)
            : null;
    const needsPaste = mode === "extract-paste" && proposals === null;
    const showRun = !results.hasResults;

    return (
        <BottomSheet
            title={FLOW_TITLES[mode]}
            subtitle={chapterLabel ? `“${chapterLabel}”` : undefined}
            onClose={close}
            bodyClassName="min-h-[10rem] space-y-3 px-4 pb-4 text-sm"
            footer={
                <>
                    {busy ? (
                        <button
                            type="button"
                            onClick={mode === "extract-story" ? sweep.stop : generation.abort}
                            className="rounded-md border px-4 py-2 text-sm"
                        >
                            {mode === "extract-story" ? "Stop (keep what's found)" : "Stop"}
                        </button>
                    ) : showRun ? (
                        <button
                            type="button"
                            onClick={() => void run()}
                            disabled={busy || (mode === "extract-paste" && !pasted.trim())}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            {busy ? "Working…" : generation.error ? "Try again" : "Run"}
                        </button>
                    ) : (
                        <>
                            {proposals !== null && (
                                <button
                                    type="button"
                                    onClick={() => void approveEntries()}
                                    disabled={ticked.size === 0 || approving}
                                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                                >
                                    Add {ticked.size} to bible
                                </button>
                            )}
                            {(mode !== "extract-paste" || pasted.trim()) && (
                                <button
                                    type="button"
                                    onClick={() => void run()}
                                    className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
                                    title="Run again — anything new is added; nothing found so far is lost"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Look again
                                </button>
                            )}
                        </>
                    )}
                    <button type="button" onClick={close} className="rounded-md border px-4 py-2 text-sm">
                        Close
                    </button>
                </>
            }
        >
            {needsPaste && (
                <textarea
                    className="min-h-40 w-full resize-y rounded-md border bg-background p-2"
                    placeholder="Paste story text here…"
                    value={pasted}
                    onChange={e => setPasted(e.target.value)}
                />
            )}
            {busy && sweep.progress && (
                <p className="text-sm text-muted-foreground">
                    Chapter {sweep.progress.current} of {sweep.progress.total}: “{sweep.progress.title}” —{" "}
                    {sweep.progress.found} entr{sweep.progress.found === 1 ? "y" : "ies"} found so far
                </p>
            )}
            {busy && <GenerationProgress status={generation.status} stopNote={BIBLE_STOP_NOTE} />}
            {(sweepFailure ?? (!busy && generation.error)) && (
                <p className="text-destructive" role="alert">
                    {sweepFailure ?? generation.error}
                </p>
            )}

            {proposals && (
                <ProposalList proposals={proposals} entries={entries} ticked={ticked} onToggle={results.toggle} />
            )}
            {issues && <IssueList issues={issues} />}
            {updates && <UpdateList updates={updates} entries={entries} onApply={p => void applyUpdate(p)} />}
        </BottomSheet>
    );
};
