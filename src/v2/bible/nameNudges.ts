/**
 * Heuristic for the bible nudge chip (writing-process review W7): recurring
 * capitalised names in the chapter that match no bible entry. Deliberately
 * conservative — mid-sentence occurrences only, three appearances minimum —
 * because a false nudge is worse than a missed one.
 */

const STOP_WORDS = new Set([
    "the",
    "she",
    "he",
    "they",
    "but",
    "and",
    "then",
    "when",
    "while",
    "after",
    "before",
    "his",
    "her",
    "its",
    "their",
    "that",
    "this",
    "there",
    "here",
    "what",
    "who",
    "why",
    "how",
    "not",
    "now",
    "yes",
    "no",
    "chapter",
    "prologue",
    "epilogue",
    "mr",
    "mrs",
    "ms",
    "dr"
]);

const MIN_OCCURRENCES = 3;

/** Capitalised runs of 1-3 words, captured only mid-sentence (not after ., ! or ?). */
const MID_SENTENCE_NAME = /(?<=[,;:a-z0-9""'’—–-]\s|\)\s)([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,}){0,2})/g;

/**
 * One-shot handoff from the editor's nudge chip to the bible screen: the
 * chip's "Add to bible" carries the spotted names so arrival auto-opens a
 * focused extraction — navigation alone is not "adding".
 */
const handoff: { names: string[] } = { names: [] };

export const setNudgeHandoff = (names: string[]) => {
    handoff.names = names;
};

export const takeNudgeHandoff = (): string[] => {
    const names = handoff.names;
    handoff.names = [];
    return names;
};

export const findUnmatchedNames = (text: string, knownNames: string[]): string[] => {
    // Known set carries full names AND their individual words, so "Brandt"
    // is covered by a bible entry named "Captain Brandt"
    const known = new Set(knownNames.flatMap(name => [name.toLowerCase(), ...name.toLowerCase().split(/\s+/)]));
    const counts = new Map<string, number>();

    for (const match of text.matchAll(MID_SENTENCE_NAME)) {
        const candidate = match[1];
        const lower = candidate.toLowerCase();
        if (STOP_WORDS.has(lower)) continue;
        counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
    }

    return [...counts.entries()]
        .filter(([candidate, count]) => {
            const lower = candidate.toLowerCase();
            if (count < MIN_OCCURRENCES) return false;
            // Skip when the candidate or any of its words matches a known name/alias
            if (known.has(lower)) return false;
            return !candidate.split(" ").some(word => known.has(word.toLowerCase()));
        })
        .sort((a, b) => b[1] - a[1])
        .map(([candidate]) => candidate)
        .slice(0, 3);
};
