import { attempt } from "@jfdi/attempt";
import { isDeepStrictEqual } from "node:util";
import { parseSerialisedDocument } from "../../src/v2/export/blocks.js";
import { blocksToPlainText } from "../../src/v2/export/toPlainText.js";

/**
 * A revision marks prose that has moved on enough to make derived work (the
 * chapter summary) out of date. Anything less is still saved, but costs no
 * regeneration. Thresholds are words added or removed since the last
 * revision, case- and punctuation-insensitive.
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

const wordBag = (text: string): Map<string, number> =>
    (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? ([] as string[])).reduce(
        (bag, word) => bag.set(word, (bag.get(word) ?? 0) + 1),
        new Map<string, number>()
    );

export const changedWordCount = (before: string, after: string): number => {
    const a = wordBag(before);
    const b = wordBag(after);
    return [...new Set([...a.keys(), ...b.keys()])].reduce(
        (sum, word) => sum + Math.abs((a.get(word) ?? 0) - (b.get(word) ?? 0)),
        0
    );
};

export const isSignificantChange = (before: string, after: string): boolean => {
    const baseWords = [...wordBag(before).values()].reduce((sum, n) => sum + n, 0);
    const threshold = Math.max(MIN_CHANGED_WORDS, Math.ceil(baseWords * MIN_CHANGED_FRACTION));
    return changedWordCount(before, after) >= threshold;
};
