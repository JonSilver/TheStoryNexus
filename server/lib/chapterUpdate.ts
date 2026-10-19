import { isSignificantChange, proseOf, sameDocument } from "./proseChange.js";

/**
 * Chapter update resolution. Two counters, two jobs:
 * - saveVersion: optimistic concurrency. Moves on every save whose document
 *   actually differs; content saves must carry expectedSaveVersion (409 on
 *   mismatch), so no edit — however small — is silently overwritten.
 * - revision: significant prose change only (see proseChange.ts). Summary
 *   freshness hangs off it, so typing a word never makes paid background
 *   work due.
 * A save of an identical document writes nothing.
 */
type ChapterUpdateBody = Record<string, unknown> & { expectedSaveVersion?: unknown; backgroundSummary?: unknown };

interface CurrentChapter {
    saveVersion: number;
    revision: number;
    content: string;
    revisionText: string | null;
}

export type ChapterUpdateResolution =
    | { outcome: "conflict" }
    | { outcome: "invalid"; error: string }
    | { outcome: "unchanged" }
    | { outcome: "apply"; updates: Record<string, unknown>; summaryGuard?: SummaryGuard };

/**
 * A background summary may only land on the summary it set out to replace:
 * never on one the writer saved or locked while the model was running.
 */
export interface SummaryGuard {
    expectedSourceRevision: number | null;
}

const SERVER_MANAGED = new Set([
    "id",
    "createdAt",
    "revision",
    "saveVersion",
    "revisionText",
    "autoSummaryRevision",
    "expectedRevision"
]);

const parseSummaryGuard = (value: unknown): SummaryGuard | null | "invalid" => {
    if (value === undefined) return null;
    const expected = (value as { expectedSourceRevision?: unknown } | null)?.expectedSourceRevision;
    return expected === null || typeof expected === "number" ? { expectedSourceRevision: expected } : "invalid";
};

export const resolveChapterUpdate = (
    current: CurrentChapter,
    body: ChapterUpdateBody,
    now: Date
): ChapterUpdateResolution => {
    const { expectedSaveVersion, backgroundSummary, ...rest } = body;
    const updates = Object.fromEntries(Object.entries(rest).filter(([key]) => !SERVER_MANAGED.has(key)));
    const summaryGuard = parseSummaryGuard(backgroundSummary);
    if (summaryGuard === "invalid")
        return { outcome: "invalid", error: "backgroundSummary needs expectedSourceRevision" };
    if (summaryGuard) {
        const keys = Object.keys(updates);
        if (keys.some(key => key !== "summary" && key !== "summarySourceRevision"))
            return { outcome: "invalid", error: "A background summary write may only set the summary" };
        return { outcome: "apply", updates: { ...updates, updatedAt: now }, summaryGuard };
    }

    if (!Object.prototype.hasOwnProperty.call(updates, "content"))
        return Object.keys(updates).length === 0
            ? { outcome: "unchanged" }
            : { outcome: "apply", updates: { ...updates, updatedAt: now } };

    if (typeof updates.content !== "string") return { outcome: "invalid", error: "content must be a string" };
    // No version (a tab still running an older build): treat as a conflict, so
    // the client locks and offers the draft for download instead of retrying
    // a rejected save forever while the writer keeps typing
    if (typeof expectedSaveVersion !== "number" || expectedSaveVersion !== current.saveVersion)
        return { outcome: "conflict" };

    const { content, ...others } = updates as Record<string, unknown> & { content: string };
    if (sameDocument(current.content, content)) {
        const { wordCount: _wordCount, ...meta } = others;
        return Object.keys(meta).length === 0
            ? { outcome: "unchanged" }
            : { outcome: "apply", updates: { ...meta, updatedAt: now } };
    }

    const base = current.revisionText ?? proseOf(current.content);
    const next = proseOf(content);
    // Unreadable prose can't be measured: treat it as significant rather than
    // let a summary silently go stale-but-"fresh"
    const significant = base === null || next === null || isSignificantChange(base, next);
    return {
        outcome: "apply",
        updates: {
            ...others,
            content,
            updatedAt: now,
            saveVersion: current.saveVersion + 1,
            // The base is pinned on first use so small edits accumulate
            // against it instead of each being measured against the last save
            ...(significant ? { revision: current.revision + 1, revisionText: next } : { revisionText: base })
        }
    };
};
