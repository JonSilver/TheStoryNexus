import { attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyChapterToCaches } from "@/features/chapters/hooks/useChaptersQuery";
import type { Chapter } from "@/types/story";

export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "conflict";

interface SavePayload {
    content: string;
    wordCount: number;
}

type SaveResult =
    | { outcome: "ok"; chapter: Chapter }
    | { outcome: "conflict"; current: Chapter }
    | { outcome: "error"; message: string };

const KEEPALIVE_BODY_LIMIT = 60_000;

const putChapterContent = async (
    chapterId: string,
    payload: SavePayload,
    expectedRevision: number,
    exiting = false
): Promise<SaveResult> => {
    const body = JSON.stringify({ ...payload, expectedRevision });
    const [error, response] = await attemptPromise(() =>
        fetch(`/api/chapters/${chapterId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body,
            // keepalive survives page teardown but caps the body (~64KB);
            // larger saves fall back to a normal fetch and rely on the
            // visibilitychange flush firing while the page is still alive
            keepalive: exiting && new Blob([body]).size < KEEPALIVE_BODY_LIMIT
        })
    );
    if (error || !response) return { outcome: "error", message: (error as Error)?.message ?? "Network error" };
    if (response.status === 409) {
        const body = await response.json().catch(() => ({}));
        return { outcome: "conflict", current: body.current };
    }
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return { outcome: "error", message: body.error || `Save failed (${response.status})` };
    }
    return { outcome: "ok", chapter: await response.json() };
};

const DEBOUNCE_MS = 1000;
const RETRY_MS = 5000;

/**
 * Single-flight, coalescing, revision-aware chapter saver (contracts §9).
 * One save in flight per chapter; newer content replaces queued content;
 * 409 halts saving until the caller reloads; failures retry.
 */
export const useChapterSaver = (chapterId: string, initialRevision: number, initialContent: string) => {
    const [status, setStatus] = useState<SaveStatus>("idle");
    const queryClient = useQueryClient();
    const internals = useRef({
        pending: null as SavePayload | null,
        inFlight: false,
        revision: initialRevision,
        lastSavedContent: initialContent,
        conflicted: false,
        debounceTimer: 0 as ReturnType<typeof setTimeout> | 0,
        retryTimer: 0 as ReturnType<typeof setTimeout> | 0,
        conflictChapter: null as Chapter | null
    });

    const drain = useCallback(async (exiting = false): Promise<void> => {
        const s = internals.current;
        if (s.inFlight || s.conflicted || !s.pending) return;
        const payload = s.pending;
        s.pending = null;
        s.inFlight = true;
        setStatus("saving");

        const result = await putChapterContent(chapterId, payload, s.revision, exiting);
        s.inFlight = false;

        if (result.outcome === "ok") {
            s.revision = result.chapter.revision ?? s.revision + 1;
            s.lastSavedContent = payload.content;
            applyChapterToCaches(queryClient, result.chapter);
            if (s.pending) void drain();
            else setStatus("saved");
            return;
        }
        if (result.outcome === "conflict") {
            s.conflicted = true;
            s.conflictChapter = result.current;
            setStatus("conflict");
            return;
        }
        // Failed: put the payload back (unless newer content arrived) and retry
        s.pending = s.pending ?? payload;
        setStatus("failed");
        clearTimeout(s.retryTimer);
        s.retryTimer = setTimeout(() => void drain(), RETRY_MS);
    }, [chapterId, queryClient]);

    const scheduleSave = useCallback(
        (content: string, wordCount: number) => {
            const s = internals.current;
            // Reverting to the last-saved content still needs saving whenever a
            // different payload is queued or in flight, or the in-flight write
            // wins and the visible text is silently lost
            if (s.conflicted || (content === s.lastSavedContent && !s.inFlight && !s.pending)) return;
            s.pending = { content, wordCount };
            clearTimeout(s.debounceTimer);
            s.debounceTimer = setTimeout(() => void drain(), DEBOUNCE_MS);
        },
        [drain]
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
        const flushExiting = () => flush(true);
        const flushWhenHidden = () => {
            if (document.visibilityState === "hidden") flush(true);
        };
        window.addEventListener("beforeunload", flushExiting);
        window.addEventListener("pagehide", flushExiting);
        document.addEventListener("visibilitychange", flushWhenHidden);
        return () => {
            window.removeEventListener("beforeunload", flushExiting);
            window.removeEventListener("pagehide", flushExiting);
            document.removeEventListener("visibilitychange", flushWhenHidden);
            flush();
            clearTimeout(s.debounceTimer);
            clearTimeout(s.retryTimer);
        };
    }, [flush]);

    return { status, scheduleSave, flush, conflictChapter: internals.current.conflictChapter };
};
