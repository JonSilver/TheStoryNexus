import { attempt } from "@jfdi/attempt";
import { diffArrays } from "diff";
import { isDeepStrictEqual } from "node:util";
import { parseSerialisedDocument } from "../../src/v2/export/blocks.js";
import { blocksToPlainText } from "../../src/v2/export/toPlainText.js";

/**
 * A revision marks prose that has moved on enough to make derived work (the
 * chapter summary) out of date. Anything less is still saved, but costs no
 * regeneration. The measure is words inserted or deleted since the last
 * revision, in order, case- and punctuation-insensitive.
 */
const MIN_CHANGED_WORDS = 50;
const MIN_CHANGED_FRACTION = 0.05;

/** Same document, regardless of key order. Unparseable input only matches itself byte-for-byte. */
export const sameDocument = (a: string, b: string): boolean => {
    if (a === b) return true;
    const [errorA, docA] = attempt(() => JSON.parse(a) as unknown);
    const [errorB, docB] = attempt(() => JSON.parse(b) as unknown);
    return !errorA && !errorB && isDeepStrictEqual(docA, docB);
};

/** The chapter's prose as plain text — scene beats and pending suggestions excluded. Null when unreadable. */
export const proseOf = (content: string): string | null => {
    if (!content) return "";
    const [error, text] = attempt(() => blocksToPlainText(parseSerialisedDocument(content)));
    return error ? null : text;
};

const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];

// The diff runs synchronously inside the save request: time-boxed (jsdiff
// checks the budget between edit-distance layers, so it's a practical bound,
// not a hard one), and a measurement that can't finish counts as significant (SOP 6 — an unknown
// defaults towards keeping summaries honest, not towards silence)
const DIFF_BUDGET_MS = 50;

/** Words in one text and not the other, ignoring order — a lower bound on the edit distance, in linear time. */
const unorderedDistance = (a: string[], b: string[]): number => {
    const counts = new Map<string, number>();
    a.forEach(word => counts.set(word, (counts.get(word) ?? 0) + 1));
    b.forEach(word => counts.set(word, (counts.get(word) ?? 0) - 1));
    return [...counts.values()].reduce((sum, n) => sum + Math.abs(n), 0);
};

/**
 * Words inserted plus words deleted along the shortest word-level edit path —
 * order-aware, so a moved paragraph counts. Null when the measurement passes
 * `cap` or its time budget.
 */
export const changedWordCount = (before: string, after: string, cap = Number.MAX_SAFE_INTEGER): number | null => {
    const edits = diffArrays(words(before), words(after), { maxEditLength: cap, timeout: DIFF_BUDGET_MS });
    return edits ? edits.reduce((sum, part) => sum + (part.added || part.removed ? part.count : 0), 0) : null;
};

export const isSignificantChange = (before: string, after: string): boolean => {
    const a = words(before);
    const b = words(after);
    const threshold = Math.max(MIN_CHANGED_WORDS, Math.ceil(a.length * MIN_CHANGED_FRACTION));
    if (unorderedDistance(a, b) >= threshold) return true;
    const changed = changedWordCount(before, after, threshold - 1);
    return changed === null || changed >= threshold;
};
