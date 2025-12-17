import type { LorebookEntry, LorebookLevel } from "@/types/story";
import { normalizeString, stringEquals } from "@/utils/stringUtils";

export class LorebookFilterService {
    static getFilteredEntries(entries: LorebookEntry[], includeDisabled: boolean = false): LorebookEntry[] {
        return includeDisabled ? entries : entries.filter(entry => !entry.isDisabled);
    }

    static getFilteredEntriesByIds(
        entries: LorebookEntry[],
        ids: string[],
        includeDisabled: boolean = false
    ): LorebookEntry[] {
        const filtered = LorebookFilterService.getFilteredEntries(entries, includeDisabled);
        return filtered.filter(entry => ids.includes(entry.id));
    }

    static getEntriesByTag(entries: LorebookEntry[], tag: string): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries).filter(
            entry => entry.tags?.some(t => stringEquals(t, tag)) || stringEquals(entry.name, tag)
        );
    }

    static getEntriesByCategory(entries: LorebookEntry[], category: LorebookEntry["category"]): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries).filter(entry => entry.category === category);
    }

    static getAllEntries(entries: LorebookEntry[]): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries);
    }

    static getEntriesByImportance(
        entries: LorebookEntry[],
        importance: "major" | "minor" | "background"
    ): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries).filter(
            entry => entry.metadata?.importance === importance
        );
    }

    static getEntriesByStatus(entries: LorebookEntry[], status: "active" | "inactive" | "historical"): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries).filter(entry => entry.metadata?.status === status);
    }

    static getEntriesByType(entries: LorebookEntry[], type: string): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries).filter(
            entry => entry.metadata?.type && stringEquals(entry.metadata.type, type)
        );
    }

    static getEntriesByRelationship(entries: LorebookEntry[], targetId: string): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries).filter(entry =>
            entry.metadata?.relationships?.some(rel => rel.type === targetId || rel.description?.includes(targetId))
        );
    }

    static getEntriesByCustomField(entries: LorebookEntry[], field: string, value: unknown): LorebookEntry[] {
        return LorebookFilterService.getFilteredEntries(entries).filter(entry => {
            const metadata = entry.metadata as Record<string, unknown> | undefined;
            return metadata?.[field] === value;
        });
    }

    // Level-based filtering methods
    static filterByLevel(entries: LorebookEntry[], level: LorebookLevel): LorebookEntry[] {
        return entries.filter(entry => entry.level === level);
    }

    static filterByLevels(entries: LorebookEntry[], levels: LorebookLevel[]): LorebookEntry[] {
        return entries.filter(entry => levels.includes(entry.level));
    }

    static getGlobalEntries(entries: LorebookEntry[]): LorebookEntry[] {
        return LorebookFilterService.filterByLevel(entries, "global");
    }

    static getSeriesEntries(entries: LorebookEntry[], seriesId: string): LorebookEntry[] {
        return entries.filter(entry => entry.level === "series" && entry.scopeId === seriesId);
    }

    static getStoryEntries(entries: LorebookEntry[], storyId: string): LorebookEntry[] {
        return entries.filter(entry => entry.level === "story" && entry.scopeId === storyId);
    }

    static getInheritedEntries(entries: LorebookEntry[], seriesId?: string): LorebookEntry[] {
        const global = LorebookFilterService.getGlobalEntries(entries);

        if (seriesId) {
            const series = LorebookFilterService.getSeriesEntries(entries, seriesId);
            return [...global, ...series];
        }

        return global;
    }

    static separateByLevel(entries: LorebookEntry[]): {
        global: LorebookEntry[];
        series: LorebookEntry[];
        story: LorebookEntry[];
    } {
        return {
            global: LorebookFilterService.filterByLevel(entries, "global"),
            series: LorebookFilterService.filterByLevel(entries, "series"),
            story: LorebookFilterService.filterByLevel(entries, "story")
        };
    }

    static getEditableEntries(entries: LorebookEntry[], editLevel: LorebookLevel, scopeId?: string): LorebookEntry[] {
        if (editLevel === "global") return LorebookFilterService.getGlobalEntries(entries);

        if (editLevel === "series" && scopeId) return LorebookFilterService.getSeriesEntries(entries, scopeId);

        if (editLevel === "story" && scopeId) return LorebookFilterService.getStoryEntries(entries, scopeId);

        return [];
    }

    static matchEntriesInText(
        entries: LorebookEntry[],
        text: string,
        options: {
            includeDisabled?: boolean;
            levels?: LorebookLevel[];
        } = {}
    ): LorebookEntry[] {
        let filtered = entries;

        // Filter by level if specified
        if (options.levels) filtered = LorebookFilterService.filterByLevels(filtered, options.levels);

        // Filter out disabled unless specified
        if (!options.includeDisabled) filtered = LorebookFilterService.getFilteredEntries(filtered, false);

        // Match tags in text
        const lowerText = text.toLowerCase();
        return filtered.filter(entry => entry.tags.some(tag => lowerText.includes(tag.toLowerCase())));
    }

    static buildTagMap(entries: LorebookEntry[]): Record<string, LorebookEntry> {
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
    }
}
