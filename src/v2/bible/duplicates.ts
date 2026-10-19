import type { LorebookEntry } from "@/types/story";

/**
 * Likely-duplicate detection so the writer doesn't hunt the pair by hand:
 * same name (case-insensitive), one name contained in the other on a word
 * boundary ("Brandon" ⊂ "Colonel Brandon"), or a shared alias/name↔tag.
 */

const norm = (s: string) => s.trim().toLowerCase();

const containsWord = (longer: string, shorter: string): boolean =>
    new RegExp(`\\b${shorter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(longer);

const aliasesOf = (entry: LorebookEntry): string[] => [
    norm(entry.name),
    ...(Array.isArray(entry.tags) ? entry.tags.map(norm) : [])
];

export interface DuplicatePair {
    a: LorebookEntry;
    b: LorebookEntry;
    reason: string;
}

export const findDuplicatePairs = (entries: LorebookEntry[]): DuplicatePair[] => {
    const pairs: DuplicatePair[] = [];
    for (let i = 0; i < entries.length; i += 1)
        for (let j = i + 1; j < entries.length; j += 1) {
            const a = entries[i];
            const b = entries[j];
            if (a.category !== b.category) continue;
            const an = norm(a.name);
            const bn = norm(b.name);
            if (an === bn) {
                pairs.push({ a, b, reason: "same name" });
                continue;
            }
            if (containsWord(an, bn) || containsWord(bn, an)) {
                pairs.push({ a, b, reason: "name contains the other" });
                continue;
            }
            const aAliases = new Set(aliasesOf(a));
            const shared = aliasesOf(b).find(alias => aAliases.has(alias));
            if (shared) pairs.push({ a, b, reason: `shared alias “${shared}”` });
        }
    return pairs;
};

/** Case-insensitive match over name, aliases and description. */
export const entryMatches = (entry: LorebookEntry, needle: string): boolean => {
    const n = norm(needle);
    return (
        !n ||
        norm(entry.name).includes(n) ||
        (Array.isArray(entry.tags) && entry.tags.some(t => norm(t).includes(n))) ||
        norm(entry.description).includes(n)
    );
};
