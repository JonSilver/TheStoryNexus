import { attempt } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { isEqual } from "lodash";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyChapterToCaches } from "@/features/chapters/hooks/useChaptersQuery";
import { chaptersApi } from "@/services/api/client";
import type { Chapter } from "@/types/story";

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
    const onSavedRef = useRef(onSaved);
    onSavedRef.current = onSaved;
    const queryClient = useQueryClient();
    const internals = useRef({
        pending: null as SavePayload | null,
        inFlight: false,
        saveVersion: initialSaveVersion,
        lastSavedDocument: parseDocument(initialContent),
        conflicted: false,
        debounceTimer: 0 as ReturnType<typeof setTimeout> | 0,
        retryTimer: 0 as ReturnType<typeof setTimeout> | 0,
        conflictChapter: null as Chapter | null
    });

    const drain = useCallback(
        async (exiting = false): Promise<void> => {
            const s = internals.current;
            if (s.inFlight || s.conflicted || !s.pending) return;
            const payload = s.pending;
            s.pending = null;
            s.inFlight = true;
            setStatus("saving");

            const request = putChapterContent(chapterId, payload, s.saveVersion, exiting);
            const tracked = request.then(
                () => undefined,
                () => undefined
            );
            inFlightSaves.set(chapterId, tracked);
            void tracked.finally(() => {
                if (inFlightSaves.get(chapterId) === tracked) inFlightSaves.delete(chapterId);
            });
            const result = await request;
            s.inFlight = false;

            if (result.outcome === "ok") {
                s.saveVersion = result.chapter.saveVersion ?? s.saveVersion;
                s.lastSavedDocument = payload.doc;
                applyChapterToCaches(queryClient, result.chapter);
                onSavedRef.current?.(result.chapter);
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
        },
        [chapterId, queryClient]
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
            flush();
            clearTimeout(s.debounceTimer);
            clearTimeout(s.retryTimer);
        };
    }, [flush, chapterId]);

    return { status, scheduleSave, flush, conflictChapter: internals.current.conflictChapter };
};
