import { useRef, useState } from "react";
import type { useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";
import { type EntryProposal, parseEntryProposals } from "./parseProposals";

export interface SweepProgress {
    current: number;
    total: number;
    title: string;
    /** Distinct proposals gathered so far — live, not end-of-job. */
    found: number;
}

interface SweepResult {
    gathered: EntryProposal[];
    /** Chapters whose extraction failed, with why. */
    failures: Array<{ title: string; error: string }>;
    /** Stopped early because the model kept failing — not worth paying for the rest. */
    gaveUp: boolean;
}

/** What the writer needs to hear about failed chapters, or null when none failed. */
export const describeSweepFailures = ({ failures, gaveUp }: SweepResult, total: number): string | null => {
    const last = failures[failures.length - 1]?.error;
    if (!failures.length) return null;
    const named = failures.map(f => `“${f.title}”`).join(", ");
    if (gaveUp)
        return `Stopped after two chapters in a row failed (${named}) — ${last} Fix that, then run again; anything found so far is below.`;
    return `${failures.length} of ${total} chapters couldn't be read (${named}) — ${last}`;
};

// Two chapters failing in a row means the model or server is broken, not the
// chapter: stop rather than pay for (and wait through) the rest of the book
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Whole-story extraction sweep (the post-import journey): one extraction per
 * chapter, sequentially, deduped across the batch into a single review list.
 * Stop keeps everything gathered so far — partial work is work.
 */
export const useStorySweep = (
    storyId: string,
    chapters: Array<{ id: string; title: string }>,
    generation: ReturnType<typeof useActionGeneration>
) => {
    const [progress, setProgress] = useState<SweepProgress | null>(null);
    const stopRequested = useRef(false);

    const stop = () => {
        stopRequested.current = true;
        generation.abort();
    };

    /** `onFound` receives each chapter's new finds as they arrive, so nothing waits on the whole book. */
    const run = async (onFound: (found: EntryProposal[]) => void): Promise<SweepResult> => {
        stopRequested.current = false;
        const seen = new Set<string>();
        const gathered: EntryProposal[] = [];
        const failures: SweepResult["failures"] = [];
        const streak = { failed: 0 };
        for (const [index, chapter] of chapters.entries()) {
            if (stopRequested.current || streak.failed >= MAX_CONSECUTIVE_FAILURES) break;
            setProgress({ current: index + 1, total: chapters.length, title: chapter.title, found: gathered.length });
            await flushChapterSave(chapter.id);
            const result = await generation.run({
                actionId: "extract_entries",
                storyId,
                chapterId: chapter.id,
                editorContext: {}
            });
            if (result.outcome === "failed") {
                failures.push({ title: chapter.title, error: result.error ?? "failed" });
                streak.failed += 1;
            } else streak.failed = 0;
            // Whatever arrived is parsed — a reply can be complete before its stream fails
            const found = parseEntryProposals(result.text).filter(proposal => {
                const key = proposal.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            gathered.push(...found);
            if (found.length) onFound(found);
            setProgress(current => (current ? { ...current, found: gathered.length } : current));
        }
        setProgress(null);
        return { gathered, failures, gaveUp: streak.failed >= MAX_CONSECUTIVE_FAILURES };
    };

    return { progress, run, stop, wasStopped: () => stopRequested.current };
};
