import type { LorebookEntry, PromptContext } from "@/types/story";
import type { ILorebookFormatter, IVariableResolver } from "./types";

const getFilteredEntries = (entries: LorebookEntry[], includeDisabled = false): LorebookEntry[] =>
    includeDisabled ? entries : entries.filter(entry => !entry.isDisabled);

const getEntriesByCategory = (entries: LorebookEntry[], category: LorebookEntry["category"]): LorebookEntry[] =>
    entries.filter(entry => entry.category === category && !entry.isDisabled);

export class MatchedEntriesChapterResolver implements IVariableResolver {
    constructor(private formatter: ILorebookFormatter) {}

    async resolve(context: PromptContext): Promise<string> {
        if (!context.chapterMatchedEntries || context.chapterMatchedEntries.size === 0) return "";

        const entries = Array.from(context.chapterMatchedEntries).filter(entry => !entry.isDisabled);

        if (entries.length === 0) return "";

        entries.sort((a, b) => {
            const importanceOrder = { major: 0, minor: 1, background: 2 };
            const aImportance = a.metadata?.importance || "background";
            const bImportance = b.metadata?.importance || "background";
            return importanceOrder[aImportance] - importanceOrder[bImportance];
        });

        return this.formatter.formatEntries(entries);
    }
}

export class SceneBeatMatchedEntriesResolver implements IVariableResolver {
    constructor(private formatter: ILorebookFormatter) {}

    async resolve(context: PromptContext): Promise<string> {
        if (!context.sceneBeatMatchedEntries || context.sceneBeatMatchedEntries.size === 0) return "";

        const entries = Array.from(context.sceneBeatMatchedEntries).filter(entry => !entry.isDisabled);

        if (entries.length === 0) return "";

        entries.sort((a, b) => {
            const importanceOrder = { major: 0, minor: 1, background: 2 };
            const aImportance = a.metadata?.importance || "background";
            const bImportance = b.metadata?.importance || "background";
            return importanceOrder[aImportance] - importanceOrder[bImportance];
        });

        return this.formatter.formatEntries(entries);
    }
}

export class AllEntriesResolver implements IVariableResolver {
    constructor(
        private formatter: ILorebookFormatter,
        private entries: LorebookEntry[]
    ) {}

    async resolve(_context: PromptContext, category?: string): Promise<string> {
        let filtered = getFilteredEntries(this.entries);
        // Note: No storyId filter needed - hierarchical query already returns correct entries

        if (category) filtered = filtered.filter(entry => entry.category === category);

        return this.formatter.formatEntries(filtered);
    }
}

export class CharacterResolver implements IVariableResolver {
    constructor(
        private formatter: ILorebookFormatter,
        private entries: LorebookEntry[]
    ) {}

    async resolve(_context: PromptContext, name: string): Promise<string> {
        // Note: No storyId filter needed - hierarchical query already returns correct entries
        const filtered = getFilteredEntries(this.entries).filter(
            entry => entry.category === "character" && entry.name.toLowerCase() === name.toLowerCase()
        );

        const matchedEntry = filtered[0];

        return matchedEntry ? this.formatter.formatEntries([matchedEntry]) : "";
    }
}

// Factory function to create category-specific resolver classes
const createCategoryResolver = (category: LorebookEntry["category"]) =>
    class CategoryResolver implements IVariableResolver {
        constructor(
            private formatter: ILorebookFormatter,
            private entries: LorebookEntry[]
        ) {}

        async resolve(_context: PromptContext): Promise<string> {
            // Note: No storyId filter needed - hierarchical query already returns correct entries
            const filtered = getEntriesByCategory(this.entries, category);
            return this.formatter.formatEntries(filtered);
        }
    };

// Export individual resolver classes for backwards compatibility
export const AllCharactersResolver = createCategoryResolver("character");
export const AllLocationsResolver = createCategoryResolver("location");
export const AllItemsResolver = createCategoryResolver("item");
export const AllEventsResolver = createCategoryResolver("event");
export const AllNotesResolver = createCategoryResolver("note");
export const AllSynopsisResolver = createCategoryResolver("synopsis");
export const AllStartingScenariosResolver = createCategoryResolver("starting scenario");
export const AllTimelinesResolver = createCategoryResolver("timeline");

export class SceneBeatContextResolver implements IVariableResolver {
    constructor(
        private formatter: ILorebookFormatter,
        private entries: LorebookEntry[]
    ) {}

    async resolve(context: PromptContext): Promise<string> {
        const uniqueEntries = new Map<string, LorebookEntry>();

        if (context.sceneBeatContext) {
            const { useMatchedChapter, useMatchedSceneBeat, useCustomContext, customContextItems } =
                context.sceneBeatContext;

            if (useMatchedChapter && context.chapterMatchedEntries && context.chapterMatchedEntries.size > 0) {
                context.chapterMatchedEntries.forEach(entry => {
                    uniqueEntries.set(entry.id, entry);
                });
            }

            if (useMatchedSceneBeat && context.sceneBeatMatchedEntries && context.sceneBeatMatchedEntries.size > 0) {
                context.sceneBeatMatchedEntries.forEach(entry => {
                    uniqueEntries.set(entry.id, entry);
                });
            }

            if (useCustomContext && customContextItems && customContextItems.length > 0) {
                const customEntries = this.entries.filter(entry => customContextItems.includes(entry.id));

                customEntries.forEach(entry => {
                    uniqueEntries.set(entry.id, entry);
                });
            }
        } else if (context.matchedEntries && context.matchedEntries.size > 0) {
            context.matchedEntries.forEach(entry => {
                uniqueEntries.set(entry.id, entry);
            });
        }

        const sortedEntries = Array.from(uniqueEntries.values()).sort((a, b) => {
            const importanceOrder = { major: 3, minor: 2, background: 1 };
            const aImportance = a.metadata?.importance || "background";
            const bImportance = b.metadata?.importance || "background";
            return importanceOrder[bImportance] - importanceOrder[aImportance];
        });

        if (sortedEntries.length === 0) return "No lorebook entries are available for this prompt.";

        return this.formatter.formatEntries(sortedEntries);
    }
}
