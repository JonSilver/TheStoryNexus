import { attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { applyChapterToCaches } from "@/features/chapters/hooks/useChaptersQuery";
import type { Chapter } from "@/types/story";
import { streamAction } from "../ai/streamAction";
import { useV2Store } from "../state/useV2Store";

const IDLE_MS = 90_000;
const MIN_WORDS = 150;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Background summary freshness (writing-process review W4): when saves have
 * settled and the editor has been idle, a stale summary regenerates silently
 * via the summarise action (which respects its per-action model override).
 * The freshness fields (summarySourceRevision vs revision) both trigger the
 * run and prevent loops. Failures are surfaced (persistently, once): a
 * broken background job the writer can't see is a silent data-quality bug.
 */
export const useAutoSummarise = (chapter: Chapter) => {
    const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);
    const running = useRef(false);
    const failures = useRef(0);
    const queryClient = useQueryClient();
    const { autoSummarise } = useV2Store();
    const enabled = useRef(autoSummarise);
    enabled.current = autoSummarise;

    const schedule = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void refreshIfStale(chapter.id), IDLE_MS);
    };

    // Real editor activity forgives past failures; internal re-arms don't —
    // a permanently broken summarise path must not fire a paid generation
    // every 90s for as long as the editor sits idle
    const noteActivity = () => {
        failures.current = 0;
        schedule();
    };

    const refreshIfStale = async (chapterId: string) => {
        if (!enabled.current || running.current) return;
        const [error, response] = await attemptPromise(() => fetch(`/api/chapters/${chapterId}`));
        if (error || !response?.ok) return;
        const fresh: Chapter = await response.json();
        const stale = (fresh.summarySourceRevision ?? -1) !== (fresh.revision ?? 0);
        // A hand-written summary is never overwritten by background work
        if (fresh.summaryLocked || !stale || (fresh.wordCount ?? 0) < MIN_WORDS) return;

        // A run that fails, or lands while the content has already moved on,
        // must not strand the summary stale until the next edit — re-arm,
        // but give up after repeated failures until the writer types again
        const rearmAfterFailure = () => {
            failures.current += 1;
            if (failures.current < MAX_CONSECUTIVE_FAILURES) schedule();
        };

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
                        // Background work must never fail silently: one persistent,
                        // de-duplicated warning that says what broke and what to do
                        toast.error(
                            `Background chapter summaries aren't working: ${
                                error ?? "the model returned an empty summary"
                            } Turn this off in Settings if you don't need it.`,
                            { toastId: "auto-summarise-failure", autoClose: false }
                        );
                        rearmAfterFailure();
                        return;
                    }
                    failures.current = 0;
                    void attemptPromise(async () => {
                        const response = await fetch(`/api/chapters/${chapterId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ summary, summarySourceRevision: baseRevision })
                        });
                        if (!response.ok) return;
                        const updated: Chapter = await response.json();
                        applyChapterToCaches(queryClient, updated);
                        // Content moved while summarising — not a failure, still stale
                        if ((updated.summarySourceRevision ?? -1) !== (updated.revision ?? 0)) schedule();
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
