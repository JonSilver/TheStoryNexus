/**
 * Lorebook alias matching (v2 contracts §7).
 * Word-boundary, Unicode-normalised (NFKC, casefolded) matching of entry
 * aliases (name + tags) against text, with possessive tolerance, deterministic
 * ranking (level specificity, then occurrences, then name) and truncation.
 */

export type LorebookLevel = "global" | "series" | "story";

export interface MatchableEntry {
    id: string;
    name: string;
    tags: string[];
    level: LorebookLevel;
    isDisabled?: boolean | null;
}

export interface EntryMatch<T extends MatchableEntry = MatchableEntry> {
    entry: T;
    occurrences: number;
    matchedAliases: string[];
}

const LEVEL_RANK: Record<LorebookLevel, number> = { story: 3, series: 2, global: 1 };

const normalise = (text: string): string => text.normalize("NFKC").toLowerCase();

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Word boundary that works beyond ASCII: no letter/number may adjoin the alias.
// Trailing possessive ('s / ’s) tolerated.
const aliasPattern = (alias: string): RegExp =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?:['’]s)?(?![\\p{L}\\p{N}])`, "gu");

const countOccurrences = (normalisedText: string, alias: string): number => {
    const matches = normalisedText.match(aliasPattern(alias));
    return matches ? matches.length : 0;
};

const entryAliases = (entry: MatchableEntry): string[] => [
    ...new Set([entry.name, ...entry.tags].map(alias => normalise(alias.trim())).filter(alias => alias.length > 0))
];

export const matchEntries = <T extends MatchableEntry>(text: string, entries: T[]): EntryMatch<T>[] => {
    const normalisedText = normalise(text);
    if (!normalisedText.trim()) return [];

    return entries
        .filter(entry => !entry.isDisabled)
        .map(entry => {
            const counts = entryAliases(entry).map(alias => ({
                alias,
                count: countOccurrences(normalisedText, alias)
            }));
            const matched = counts.filter(c => c.count > 0);
            return {
                entry,
                occurrences: matched.reduce((sum, c) => sum + c.count, 0),
                matchedAliases: matched.map(c => c.alias)
            };
        })
        .filter(match => match.occurrences > 0)
        .sort(
            (a, b) =>
                LEVEL_RANK[b.entry.level] - LEVEL_RANK[a.entry.level] ||
                b.occurrences - a.occurrences ||
                a.entry.name.localeCompare(b.entry.name)
        );
};

export const truncateByRank = <T extends MatchableEntry>(
    matches: EntryMatch<T>[],
    fits: (entry: T) => number,
    budget: number
): EntryMatch<T>[] => {
    const kept: EntryMatch<T>[] = [];
    const remaining = { budget };
    for (const match of matches) {
        const cost = fits(match.entry);
        if (cost > remaining.budget) break;
        remaining.budget -= cost;
        kept.push(match);
    }
    return kept;
};
