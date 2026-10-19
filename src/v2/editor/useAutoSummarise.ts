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
const HOURLY_LIMIT = 6;
const HOUR_MS = 60 * 60_000;
const BUDGET_KEY = "storynexus-auto-summary-runs";

// Revisions already tried, per chapter — across editor remounts, so leaving
// and reopening a chapter never buys another attempt at the same revision
const attempted = new Map<string, number>();

const recentRuns = (now: number): number[] => {
    try {
        const stored = JSON.parse(localStorage.getItem(BUDGET_KEY) ?? "[]");
        return Array.isArray(stored)
            ? stored.filter((t): t is number => typeof t === "number" && now - t < HOUR_MS)
            : [];
    } catch {
        return [];
    }
};

const takeFromBudget = (): boolean => {
    const now = Date.now();
    const runs = recentRuns(now);
    if (runs.length >= HOURLY_LIMIT) return false;
    try {
        localStorage.setItem(BUDGET_KEY, JSON.stringify([...runs, now]));
    } catch {
        // Unwritable storage would make the cap unenforceable — refuse rather than run unmetered
        return false;
    }
    return true;
};

/**
 * Background summary freshness, under a strict cost limit. A summary is
 * generated only when ALL hold: the writer made a significant prose change
 * (a new revision — see server/lib/proseChange.ts) in THIS sitting, the editor
 * has then been idle, the summary is stale and not writer-locked, this
 * revision has never been tried, and the hourly budget has room. Opening or
 * reading a chapter never costs a generation; a failure is reported once and
 * not retried until the prose changes significantly again.
 */
export const useAutoSummarise = (chapter: Chapter) => {
    const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);
    const running = useRef(false);
    const openedAt = useRef({ chapterId: chapter.id, revision: chapter.revision ?? 0 });
    if (openedAt.current.chapterId !== chapter.id)
        openedAt.current = { chapterId: chapter.id, revision: chapter.revision ?? 0 };
    const queryClient = useQueryClient();
    const { autoSummarise } = useV2Store();
    const enabled = useRef(autoSummarise);
    enabled.current = autoSummarise;

    const refreshIfDue = async (chapterId: string) => {
        if (!enabled.current || running.current) return;
        const [error, response] = await attemptPromise(() => fetch(`/api/chapters/${chapterId}`));
        if (error || !response?.ok) return;
        const fresh: Chapter = await response.json();
        const revision = fresh.revision ?? 0;
        const editedThisSitting = openedAt.current.chapterId === chapterId && revision > openedAt.current.revision;
        const stale = (fresh.summarySourceRevision ?? -1) !== revision;
        if (
            !editedThisSitting ||
            !stale ||
            fresh.summaryLocked ||
            (fresh.wordCount ?? 0) < MIN_WORDS ||
            attempted.get(chapterId) === revision
        )
            return;
        // Over budget: the summary stays stale (it's labelled as possibly
        // outdated wherever it's used) until a later change finds room
        if (!takeFromBudget()) return;

        attempted.set(chapterId, revision);
        running.current = true;
        const chunks: string[] = [];
        streamAction(
            { actionId: "summarise_chapter", storyId: fresh.storyId, chapterId },
            {
                onToken: token => chunks.push(token),
                onDone: error => {
                    running.current = false;
                    const summary = chunks.join("").trim();
                    if (error || !summary) {
                        toast.error(
                            `Background chapter summaries aren't working: ${
                                error ?? "the model returned an empty summary"
                            } It won't try again until the chapter changes substantially. Turn this off in Settings if you don't need it.`,
                            { toastId: "auto-summarise-failure", autoClose: false }
                        );
                        return;
                    }
                    void attemptPromise(async () => {
                        const response = await fetch(`/api/chapters/${chapterId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ summary, summarySourceRevision: revision })
                        });
                        if (!response.ok) return;
                        applyChapterToCaches(queryClient, await response.json());
                    });
                }
            }
        );
    };

    const noteActivity = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void refreshIfDue(chapter.id), IDLE_MS);
    };

    useEffect(() => () => clearTimeout(timer.current), [chapter.id]);

    return { noteActivity };
};
