import type { LorebookEntry } from "@/types/story";
import { normalizeString, stringEquals } from "@/utils/stringUtils";

export const getFilteredEntries = (entries: LorebookEntry[], includeDisabled = false): LorebookEntry[] =>
    includeDisabled ? entries : entries.filter(entry => !entry.isDisabled);

/**
 * Builds a tag map for efficient lorebook entry lookups.
 * Used by SceneBeatNode and LorebookTagPlugin for autocomplete functionality.
 */
export const buildTagMap = (entries: LorebookEntry[]): Record<string, LorebookEntry> => {
    const tagMap: Record<string, LorebookEntry> = {};

    if (!entries || !Array.isArray(entries)) return tagMap;

    entries.forEach(entry => {
        if (!entry || entry.isDisabled) return;

        const normalizedName = normalizeString(entry.name);
        tagMap[normalizedName] = entry;

        if (!entry.tags || !Array.isArray(entry.tags)) return;

        entry.tags.forEach(tag => {
            const normalizedTag = normalizeString(tag);
            tagMap[normalizedTag] = entry;

            if (!normalizedTag.includes(" ")) return;

            const words = normalizedTag.split(" ");
            words.forEach(word => {
                if (entry.tags.some(t => stringEquals(t, word))) tagMap[word] = entry;
            });
        });
    });

    return tagMap;
};
