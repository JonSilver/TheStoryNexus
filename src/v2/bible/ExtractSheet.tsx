import { RotateCcw } from "lucide-react";
import type { LorebookEntry } from "@/types/story";
import { GenerationProgress } from "../ai/GenerationProgress";
import { BottomSheet } from "../components/BottomSheet";
import { useConfirm } from "../components/Dialogs";
import { BIBLE_STOP_NOTE, FLOW_TITLES, IssueList, ProposalList, UpdateList } from "./FlowResults";
import { useBibleFlow } from "./useBibleFlow";

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
    const confirm = useConfirm();
    const flow = useBibleFlow({
        mode,
        storyId,
        chapterId,
        entries,
        chapters,
        focusNames,
        initialText,
        onAdded: onClose
    });
    const { generation, sweep, results, pasted, setPasted, approving, sweepFailure, busy, run } = flow;
    const { proposals, updates, issues, ticked } = results;

    // Found-but-unadded entries are paid-for work: closing asks before discarding them
    const close = async () => {
        if (flow.closeQuestion && !(await confirm({ message: flow.closeQuestion, confirmLabel: "Close" }))) return;
        onClose();
    };

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
                                    onClick={() => void flow.approveEntries()}
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
            {updates && <UpdateList updates={updates} entries={entries} onApply={p => void flow.applyUpdate(p)} />}
        </BottomSheet>
    );
};
