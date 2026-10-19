import { attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { applyChapterToCaches } from "@/features/chapters/hooks/useChaptersQuery";
import type { Chapter } from "@/types/story";
import { streamAction } from "../ai/streamAction";
import { useV2Store } from "../state/useV2Store";

type BackgroundClaim =
    | { due: true; storyId: string; revision: number; summarySourceRevision: number | null }
    | { due: false; reason: string };

const IDLE_MS = 90_000;
const FAILURE_TOAST = "auto-summarise-failure";

const reportFailure = (reason: string, next = "It won't try again until the chapter changes substantially.") =>
    toast.error(
        `Background chapter summaries aren't working: ${reason} ${next} Turn this off in Settings if you don't need it.`,
        { toastId: FAILURE_TOAST, autoClose: false }
    );

/**
 * Background summary freshness under a strict cost limit. The client asks
 * only when THIS device saved a significant prose change (a new revision —
 * see server/lib/proseChange.ts) and the writer has since been idle; opening
 * or reading a chapter, here or with edits arriving from elsewhere, never asks. The server then decides,
 * before anything is spent (server/services/actions/backgroundSummary.ts): stale, unlocked, long
 * enough, never attempted for this revision on any device, and within the
 * app-wide hourly limit — otherwise it spends nothing. A failure is reported
 * once and not retried until the prose changes significantly again.
 */
export const useAutoSummarise = (chapter: Chapter) => {
    const timer = useRef<ReturnType<typeof setTimeout> | 0>(0);
    const running = useRef(false);
    const alive = useRef(true);
    // Significant changes THIS device saved: another device's edit, arriving
    // while this one only reads, never makes this one spend
    const local = useRef({ chapterId: chapter.id, knownRevision: chapter.revision ?? 0, pending: false });
    if (local.current.chapterId !== chapter.id)
        local.current = { chapterId: chapter.id, knownRevision: chapter.revision ?? 0, pending: false };
    const queryClient = useQueryClient();
    const { autoSummarise } = useV2Store();
    const enabled = useRef(autoSummarise);
    enabled.current = autoSummarise;

    const refreshIfDue = async (chapterId: string) => {
        if (!enabled.current || running.current) return;
        if (local.current.chapterId !== chapterId || !local.current.pending) return;
        running.current = true;
        const [claimError, claim] = await attemptPromise(async () => {
            const response = await fetch(`/api/chapters/${chapterId}/background-summary`, { method: "POST" });
            if (!response.ok) throw new Error(`the app's server answered ${response.status}.`);
            return (await response.json()) as BackgroundClaim;
        });
        if (claimError || !claim) {
            running.current = false;
            // Still pending: the writer's next pause asks again — no retry loop while idle
            reportFailure(
                `couldn't reach the app's server — ${(claimError as Error)?.message ?? "no answer."}`,
                "It will ask again after your next pause in writing."
            );
            return;
        }
        // One ask per local significant change, whatever the answer
        local.current.pending = false;
        if (!claim.due) {
            running.current = false;
            return;
        }
        const { storyId, revision, summarySourceRevision } = claim;
        const chunks: string[] = [];
        streamAction(
            { actionId: "summarise_chapter", storyId, chapterId },
            {
                onToken: token => chunks.push(token),
                onDone: error => {
                    running.current = false;
                    const summary = chunks.join("").trim();
                    if (error || !summary) {
                        reportFailure(error ?? "the model returned an empty summary.");
                        return;
                    }
                    void (async () => {
                        const [putError, put] = await attemptPromise(() =>
                            fetch(`/api/chapters/${chapterId}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    summary,
                                    summarySourceRevision: revision,
                                    backgroundSummary: { expectedSourceRevision: summarySourceRevision }
                                })
                            })
                        );
                        // 409: the writer saved or locked a summary meanwhile — theirs wins, by design
                        if (put?.status === 409) return;
                        if (putError || !put?.ok) {
                            reportFailure("a summary was generated but couldn't be saved.");
                            return;
                        }
                        const [parseError, saved] = await attemptPromise(() => put.json() as Promise<Chapter>);
                        // The summary is stored either way; an unreadable echo only means the next fetch syncs the cache
                        if (!parseError && saved) applyChapterToCaches(queryClient, saved);
                    })();
                }
            }
        );
    };

    const schedule = () => {
        clearTimeout(timer.current);
        // A save that settles after the editor closed must not arm a timer nothing will clear
        if (!alive.current) return;
        timer.current = setTimeout(() => void refreshIfDue(chapter.id), IDLE_MS);
    };

    /** Typing defers a pending summary until the writer pauses. */
    const noteActivity = () => {
        if (local.current.pending) schedule();
    };

    /** The saver's response: a revision bump here is this device's significant change. */
    const noteSaved = (saved: Chapter) => {
        if (saved.id !== local.current.chapterId) return;
        const revision = saved.revision ?? 0;
        if (revision > local.current.knownRevision) {
            local.current.knownRevision = revision;
            local.current.pending = true;
            schedule();
        }
    };

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            clearTimeout(timer.current);
        };
    }, [chapter.id]);

    return { noteActivity, noteSaved };
};
