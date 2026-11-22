import { attempt } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { isEqual } from "lodash";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { applyChapterToCaches } from "@/features/chapters/hooks/useChaptersQuery";
import { chaptersApi } from "@/services/api/client";
import { chaptersKeys } from "@/services/api/queryKeys";
import type { Chapter } from "@/types/story";
import { useEvent } from "../hooks/useEvent";

export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "conflict";

interface SavePayload {
    content: string;
    doc: unknown;
    wordCount: number;
}

const parseDocument = (content: string): unknown => {
    const [error, doc] = attempt(() => JSON.parse(content) as unknown);
    return error ? content : doc;
};

type SaveResult =
    | { outcome: "ok"; chapter: Chapter }
    | { outcome: "conflict"; current: Chapter }
    | { outcome: "error"; message: string };

const KEEPALIVE_BODY_LIMIT = 60_000;

const putChapterContent = async (
    chapterId: string,
    { content, wordCount }: SavePayload,
    expectedSaveVersion: number,
    exiting = false
): Promise<SaveResult> => {
    // keepalive survives page teardown but caps the body (~64KB); larger saves
    // rely on the visibilitychange flush firing while the page is still alive
    const keepalive =
        exiting && new Blob([JSON.stringify({ content, wordCount, expectedSaveVersion })]).size < KEEPALIVE_BODY_LIMIT;
    const result = await chaptersApi.saveContent(chapterId, { content, wordCount }, expectedSaveVersion, keepalive);
    if (result.ok) return { outcome: "ok", chapter: result.data };
    if (result.status === 409) return { outcome: "conflict", current: (result.body as { current: Chapter }).current };
    return { outcome: "error", message: result.error };
};

const DEBOUNCE_MS = 1000;
const RETRY_MS = 5000;
// Once the editor has closed, the exit save gets a bounded number of tries:
// a reopening editor waits on it, and nothing on screen shows it retrying
const DETACHED_ATTEMPTS = 3;
const DETACHED_RETRY_MS = 2000;

// In-flight saves by chapter, across saver instances. A remounting editor
// must wait for the previous instance's exit save to settle, or it
// initialises from a cache the settling save is about to supersede — stale
// content plus a guaranteed 409 on the next keystroke.
const inFlightSaves = new Map<string, Promise<void>>();

export const hasInFlightSave = (chapterId: string) => inFlightSaves.has(chapterId);
/**
 * Resolves only when the chapter's WHOLE save queue has drained. When a save
 * finishes, a queued newer save starts in the same tick chain — so after each
 * one, yield a macrotask and look again rather than trusting the first promise.
 */
export const whenSavesSettle = async (chapterId: string): Promise<void> => {
    while (inFlightSaves.has(chapterId)) {
        await inFlightSaves.get(chapterId);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
};

// Live saver instances by chapter, so chapter-based AI actions can force the
// debounced save down to disk before the server reads the chapter — the
// model must analyse what the writer sees, not a second-old version.
const flushers = new Map<string, () => void>();

export const flushChapterSave = async (chapterId: string): Promise<void> => {
    flushers.get(chapterId)?.();
    await whenSavesSettle(chapterId);
};

// Exit saves that failed after their editor closed, by chapter. The writer's
// text lives here until the chapter is reopened: the editor opens on it and
// its saver sends it again (against the version it was based on, so a newer
// copy elsewhere still raises the conflict banner rather than being overwritten).
const strandedDrafts = new Map<string, { payload: SavePayload; saveVersion: number }>();

/** Unsaved content a closed editor left behind for this chapter, if any. */
export const strandedContent = (chapterId: string): string | undefined =>
    strandedDrafts.get(chapterId)?.payload.content;

const exitToastId = (chapterId: string) => `exit-save-${chapterId}`;

/**
 * Single-flight, coalescing, revision-aware chapter saver (contracts §9).
 * One save in flight per chapter; newer content replaces queued content;
 * 409 halts saving until the caller reloads; failures retry.
 */
export const useChapterSaver = (
    chapterId: string,
    initialSaveVersion: number,
    initialContent: string,
    onSaved?: (chapter: Chapter) => void
) => {
    const [status, setStatus] = useState<SaveStatus>("idle");
    const notifySaved = useEvent((saved: Chapter) => onSaved?.(saved));
    const queryClient = useQueryClient();
    const internals = useRef({
        pending: null as SavePayload | null,
        inFlight: false,
        saveVersion: initialSaveVersion,
        lastSavedDocument: parseDocument(initialContent),
        conflicted: false,
        debounceTimer: 0 as ReturnType<typeof setTimeout> | 0,
        retryTimer: 0 as ReturnType<typeof setTimeout> | 0,
        detached: false,
        detachedFailures: 0,
        settleExit: null as (() => void) | null
    });

    // After the editor closes, the whole remaining exit save — retries included —
    // is one tracked unit, so a reopening editor waits for all of it
    const trackExit = useCallback(() => {
        const s = internals.current;
        if (s.settleExit || (!s.inFlight && !s.pending)) return;
        const settled = new Promise<void>(resolve => {
            s.settleExit = resolve;
        });
        inFlightSaves.set(chapterId, settled);
        void settled.finally(() => {
            if (inFlightSaves.get(chapterId) === settled) inFlightSaves.delete(chapterId);
        });
    }, [chapterId]);

    const finishExit = useCallback(() => {
        const s = internals.current;
        s.settleExit?.();
        s.settleExit = null;
    }, []);

    const strand = useCallback(
        (payload: SavePayload, saveVersion: number, conflict: boolean) => {
            strandedDrafts.set(chapterId, { payload, saveVersion });
            const title = queryClient.getQueryData<Chapter>(chaptersKeys.detail(chapterId))?.title ?? "this chapter";
            toast.error(
                conflict
                    ? `Your last edits to “${title}” weren't saved: it was changed elsewhere. Open it again to see your version and download it.`
                    : `Your last edits to “${title}” couldn't be saved. They're kept on this page — open the chapter again to save them. Reloading the page loses them.`,
                { toastId: exitToastId(chapterId), autoClose: false }
            );
        },
        [chapterId, queryClient]
    );

    const drain = useCallback(
        async function drain(exiting = false): Promise<void> {
            const s = internals.current;
            if (s.inFlight) return;
            if (s.conflicted || !s.pending) {
                if (s.detached) finishExit();
                return;
            }
            const payload = s.pending;
            s.pending = null;
            s.inFlight = true;
            setStatus("saving");

            const request = putChapterContent(chapterId, payload, s.saveVersion, exiting);
            // A detached saver's exit chain is already tracked as a whole
            if (!s.detached) {
                const tracked = request.then(
                    () => undefined,
                    () => undefined
                );
                inFlightSaves.set(chapterId, tracked);
                void tracked.finally(() => {
                    if (inFlightSaves.get(chapterId) === tracked) inFlightSaves.delete(chapterId);
                });
            }
            const result = await request;
            s.inFlight = false;

            if (result.outcome === "ok") {
                s.saveVersion = result.chapter.saveVersion ?? s.saveVersion;
                s.lastSavedDocument = payload.doc;
                s.detachedFailures = 0;
                strandedDrafts.delete(chapterId);
                toast.dismiss(exitToastId(chapterId));
                applyChapterToCaches(queryClient, result.chapter);
                notifySaved(result.chapter);
                if (s.pending) void drain();
                else if (s.detached) finishExit();
                else setStatus("saved");
                return;
            }
            if (result.outcome === "conflict") {
                s.conflicted = true;
                // The reopened editor's banner now holds this draft (Download my version)
                strandedDrafts.delete(chapterId);
                if (s.detached) {
                    strand(s.pending ?? payload, s.saveVersion, true);
                    finishExit();
                } else setStatus("conflict");
                return;
            }
            // Failed: put the payload back (unless newer content arrived) and retry
            s.pending = s.pending ?? payload;
            clearTimeout(s.retryTimer);
            if (!s.detached) {
                setStatus("failed");
                s.retryTimer = setTimeout(() => void drain(), RETRY_MS);
                return;
            }
            s.detachedFailures += 1;
            if (s.detachedFailures < DETACHED_ATTEMPTS) {
                s.retryTimer = setTimeout(() => void drain(), DETACHED_RETRY_MS);
                return;
            }
            strand(s.pending, s.saveVersion, false);
            s.pending = null;
            finishExit();
        },
        [chapterId, queryClient, notifySaved, finishExit, strand]
    );

    // Compared as documents, not strings: serialisation order is not identity
    const scheduleSave = useCallback(
        (content: string, doc: unknown, wordCount: number) => {
            const s = internals.current;
            // Reverting to the last-saved content still needs saving whenever a
            // different payload is queued or in flight, or the in-flight write
            // wins and the visible text is silently lost
            if (s.conflicted || (!s.inFlight && !s.pending && isEqual(doc, s.lastSavedDocument))) return;
            s.pending = { content, doc, wordCount };
            clearTimeout(s.debounceTimer);
            // The editor's last change can arrive after it closed (its plugins clean up
            // after the saver): no debounce then — save now, as part of the exit save
            if (s.detached) {
                void drain();
                trackExit();
                return;
            }
            s.debounceTimer = setTimeout(() => void drain(), DEBOUNCE_MS);
        },
        [drain, trackExit]
    );

    const flush = useCallback(
        (exiting = false) => {
            const s = internals.current;
            clearTimeout(s.debounceTimer);
            if (s.pending) void drain(exiting);
        },
        [drain]
    );

    // Flush on every mobile-real exit path; clean timers on unmount
    useEffect(() => {
        const s = internals.current;
        flushers.set(chapterId, () => flush());
        const flushExiting = () => flush(true);
        const flushWhenHidden = () => {
            if (document.visibilityState === "hidden") flush(true);
        };
        // Blur flushes while the page is still alive (an ordinary fetch, no
        // keepalive body cap) — big chapters get their exit save in early,
        // before pagehide can only offer the size-capped keepalive path
        const flushAlive = () => flush();
        window.addEventListener("blur", flushAlive);
        window.addEventListener("beforeunload", flushExiting);
        window.addEventListener("pagehide", flushExiting);
        document.addEventListener("visibilitychange", flushWhenHidden);
        return () => {
            window.removeEventListener("blur", flushAlive);
            window.removeEventListener("beforeunload", flushExiting);
            window.removeEventListener("pagehide", flushExiting);
            document.removeEventListener("visibilitychange", flushWhenHidden);
            if (flushers.get(chapterId) !== undefined) flushers.delete(chapterId);
            s.detached = true;
            clearTimeout(s.debounceTimer);
            clearTimeout(s.retryTimer);
            if (s.pending) void drain();
            trackExit();
        };
    }, [flush, drain, trackExit, chapterId]);

    // A draft a closed editor couldn't save: this editor opened on it, so send it now
    useEffect(() => {
        const draft = strandedDrafts.get(chapterId);
        if (!draft) return;
        const s = internals.current;
        s.saveVersion = draft.saveVersion;
        s.pending = draft.payload;
        void drain();
    }, [chapterId, drain]);

    return { status, scheduleSave, flush };
};
