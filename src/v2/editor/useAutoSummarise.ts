import { attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { applyChapterToCaches } from "@/features/chapters/hooks/useChaptersQuery";
import type { Chapter } from "@/types/story";
import { streamAction } from "../ai/streamAction";

const IDLE_MS = 90_000;
const MIN_WORDS = 150;

/**
 * Background summary freshness (writing-process review W4): when saves have
 * settled and the editor has been idle, a stale summary regenerates silently
 * via the summarise action (which respects its per-action model override).
 * The freshness fields (summarySourceRevision vs revision) both trigger the
 * run and prevent loops; failures stay silent — this is bookkeeping, not a
 * feature the writer should ever notice.
 */
export const useAutoSummarise = (chapter: Chapter) => {
    const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);
    const running = useRef(false);
    const queryClient = useQueryClient();

    const noteActivity = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void refreshIfStale(chapter.id), IDLE_MS);
    };

    const refreshIfStale = async (chapterId: string) => {
        if (running.current) return;
        const [error, response] = await attemptPromise(() => fetch(`/api/chapters/${chapterId}`));
        if (error || !response?.ok) return;
        const fresh: Chapter = await response.json();
        const stale = (fresh.summarySourceRevision ?? -1) !== (fresh.revision ?? 0);
        if (!stale || (fresh.wordCount ?? 0) < MIN_WORDS) return;

        // A run that fails, or lands while the content has already moved on,
        // must not strand the summary stale until the next edit — re-arm
        const rearm = () => noteActivity();

        running.current = true;
        const baseRevision = fresh.revision ?? 0;
        const chunks: string[] = [];
        streamAction(
            { actionId: "summarise_chapter", storyId: fresh.storyId, chapterId },
            {
                onToken: token => chunks.push(token),
                onDone: error => {
                    running.current = false;
                    const summary = chunks.join("").trim();
                    if (error || !summary) {
                        rearm();
                        return;
                    }
                    void attemptPromise(async () => {
                        const response = await fetch(`/api/chapters/${chapterId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ summary, summarySourceRevision: baseRevision })
                        });
                        if (!response.ok) return;
                        const updated: Chapter = await response.json();
                        applyChapterToCaches(queryClient, updated);
                        if ((updated.summarySourceRevision ?? -1) !== (updated.revision ?? 0)) rearm();
                    });
                }
            }
        );
    };

    useEffect(() => {
        noteActivity();
        return () => clearTimeout(timer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chapter.id]);

    return { noteActivity };
};
