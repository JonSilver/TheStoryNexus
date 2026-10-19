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

/**
 * Words inserted plus words deleted along the shortest word-level edit path —
 * order-aware, so a moved paragraph counts. Stops counting at `cap`: the diff
 * runs synchronously in the save request, and past the threshold the exact
 * figure is irrelevant.
 */
export const changedWordCount = (before: string, after: string, cap = Number.MAX_SAFE_INTEGER): number => {
    const edits = diffArrays(words(before), words(after), { maxEditLength: cap });
    if (!edits) return cap;
    return edits.reduce((sum, part) => sum + (part.added || part.removed ? part.count : 0), 0);
};

export const isSignificantChange = (before: string, after: string): boolean => {
    const threshold = Math.max(MIN_CHANGED_WORDS, Math.ceil(words(before).length * MIN_CHANGED_FRACTION));
    return changedWordCount(before, after, threshold) >= threshold;
};
