import { useRef, useState } from "react";
import type { useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";
import { type EntryProposal, parseEntryProposals } from "./parseProposals";

export interface SweepProgress {
    current: number;
    total: number;
    title: string;
}

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

    const run = async (): Promise<EntryProposal[]> => {
        stopRequested.current = false;
        const seen = new Set<string>();
        const gathered: EntryProposal[] = [];
        for (const [index, chapter] of chapters.entries()) {
            if (stopRequested.current) break;
            setProgress({ current: index + 1, total: chapters.length, title: chapter.title });
            await flushChapterSave(chapter.id);
            const text = await generation.run({
                actionId: "extract_entries",
                storyId,
                chapterId: chapter.id,
                editorContext: {}
            });
            for (const proposal of parseEntryProposals(text)) {
                const key = proposal.name.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                gathered.push(proposal);
            }
        }
        setProgress(null);
        return gathered;
    };

    return { progress, run, stop, wasStopped: () => stopRequested.current };
};
