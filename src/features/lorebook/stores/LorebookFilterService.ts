import type { LorebookEntry, LorebookLevel } from "@/types/story";
import { normalizeString, stringEquals } from "@/utils/stringUtils";

export const getFilteredEntries = (entries: LorebookEntry[], includeDisabled = false): LorebookEntry[] =>
    includeDisabled ? entries : entries.filter(entry => !entry.isDisabled);

export const getFilteredEntriesByIds = (
    entries: LorebookEntry[],
    ids: string[],
    includeDisabled = false
): LorebookEntry[] => getFilteredEntries(entries, includeDisabled).filter(entry => ids.includes(entry.id));

export const getEntriesByTag = (entries: LorebookEntry[], tag: string): LorebookEntry[] =>
    getFilteredEntries(entries).filter(
        entry => entry.tags?.some(t => stringEquals(t, tag)) || stringEquals(entry.name, tag)
    );

export const getEntriesByCategory = (entries: LorebookEntry[], category: LorebookEntry["category"]): LorebookEntry[] =>
    getFilteredEntries(entries).filter(entry => entry.category === category);

export const getAllEntries = (entries: LorebookEntry[]): LorebookEntry[] => getFilteredEntries(entries);

export const getEntriesByImportance = (
    entries: LorebookEntry[],
    importance: "major" | "minor" | "background"
): LorebookEntry[] => getFilteredEntries(entries).filter(entry => entry.metadata?.importance === importance);

export const getEntriesByStatus = (
    entries: LorebookEntry[],
    status: "active" | "inactive" | "historical"
): LorebookEntry[] => getFilteredEntries(entries).filter(entry => entry.metadata?.status === status);

export const getEntriesByType = (entries: LorebookEntry[], type: string): LorebookEntry[] =>
    getFilteredEntries(entries).filter(entry => entry.metadata?.type && stringEquals(entry.metadata.type, type));

export const getEntriesByRelationship = (entries: LorebookEntry[], targetId: string): LorebookEntry[] =>
    getFilteredEntries(entries).filter(entry =>
        entry.metadata?.relationships?.some(rel => rel.type === targetId || rel.description?.includes(targetId))
    );

export const getEntriesByCustomField = (entries: LorebookEntry[], field: string, value: unknown): LorebookEntry[] =>
    getFilteredEntries(entries).filter(entry => {
        const metadata = entry.metadata as Record<string, unknown> | undefined;
        return metadata?.[field] === value;
    });

export const filterByLevel = (entries: LorebookEntry[], level: LorebookLevel): LorebookEntry[] =>
    entries.filter(entry => entry.level === level);

export const filterByLevels = (entries: LorebookEntry[], levels: LorebookLevel[]): LorebookEntry[] =>
    entries.filter(entry => levels.includes(entry.level));

export const getGlobalEntries = (entries: LorebookEntry[]): LorebookEntry[] => filterByLevel(entries, "global");

export const getSeriesEntries = (entries: LorebookEntry[], seriesId: string): LorebookEntry[] =>
    entries.filter(entry => entry.level === "series" && entry.scopeId === seriesId);

export const getStoryEntries = (entries: LorebookEntry[], storyId: string): LorebookEntry[] =>
    entries.filter(entry => entry.level === "story" && entry.scopeId === storyId);

export const getInheritedEntries = (entries: LorebookEntry[], seriesId?: string): LorebookEntry[] => {
    const global = getGlobalEntries(entries);
    if (seriesId) {
        const series = getSeriesEntries(entries, seriesId);
        return [...global, ...series];
    }
    return global;
};

export const separateByLevel = (
    entries: LorebookEntry[]
): {
    global: LorebookEntry[];
    series: LorebookEntry[];
    story: LorebookEntry[];
} => ({
    global: filterByLevel(entries, "global"),
    series: filterByLevel(entries, "series"),
    story: filterByLevel(entries, "story")
});

export const getEditableEntries = (
    entries: LorebookEntry[],
    editLevel: LorebookLevel,
    scopeId?: string
): LorebookEntry[] => {
    if (editLevel === "global") return getGlobalEntries(entries);
    if (editLevel === "series" && scopeId) return getSeriesEntries(entries, scopeId);
    if (editLevel === "story" && scopeId) return getStoryEntries(entries, scopeId);
    return [];
};

export const matchEntriesInText = (
    entries: LorebookEntry[],
    text: string,
    options: {
        includeDisabled?: boolean;
        levels?: LorebookLevel[];
    } = {}
): LorebookEntry[] => {
    let filtered = entries;
    if (options.levels) filtered = filterByLevels(filtered, options.levels);
    if (!options.includeDisabled) filtered = getFilteredEntries(filtered, false);
    const lowerText = text.toLowerCase();
    return filtered.filter(entry => entry.tags.some(tag => lowerText.includes(tag.toLowerCase())));
};

export const buildTagMap = (entries: LorebookEntry[]): Record<string, LorebookEntry> => {
    const tagMap: Record<string, LorebookEntry> = {};

    if (!entries || !Array.isArray(entries)) return tagMap;

    for (const entry of entries) {
        if (!entry || entry.isDisabled) continue;

        const normalizedName = normalizeString(entry.name);
        tagMap[normalizedName] = entry;

        if (!entry.tags || !Array.isArray(entry.tags)) continue;

        for (const tag of entry.tags) {
            const normalizedTag = normalizeString(tag);
            tagMap[normalizedTag] = entry;

            if (!normalizedTag.includes(" ")) continue;

            const words = normalizedTag.split(" ");
            for (const word of words) {
                if (entry.tags.some(t => stringEquals(t, word))) tagMap[word] = entry;
            }
        }
    }

    return tagMap;
};
