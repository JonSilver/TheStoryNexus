# Task 15: Filter Service Updates

## Objective

Add level-based filtering functions to lorebook filter service.

## Context

- Support filtering entries by level (global/series/story)
- Support getting inherited entries for a story
- Maintain existing category/tag/disabled filtering

## Dependencies

- **Task 02**: Updated types with level field
- **Existing**: LorebookFilterService

## File Locations

- **Modify**: `src/services/lorebook/lorebookFilters.ts` (or wherever filter logic lives)

## Implementation Steps

### 1. Add Level Filtering Functions

```typescript
// In src/services/lorebook/lorebookFilters.ts
import type { LorebookEntry, LorebookLevel, LorebookCategory } from "@/types/entities";

export class LorebookFilterService {
    // EXISTING: Filter by category
    static filterByCategory(entries: LorebookEntry[], category: LorebookCategory): LorebookEntry[] {
        return entries.filter(entry => entry.category === category);
    }

    // EXISTING: Filter by tags
    static filterByTags(entries: LorebookEntry[], tags: string[]): LorebookEntry[] {
        return entries.filter(entry => entry.tags.some(tag => tags.includes(tag)));
    }

    // EXISTING: Filter out disabled
    static filterActive(entries: LorebookEntry[]): LorebookEntry[] {
        return entries.filter(entry => !entry.isDisabled);
    }

    // NEW: Filter by level
    static filterByLevel(entries: LorebookEntry[], level: LorebookLevel): LorebookEntry[] {
        return entries.filter(entry => entry.level === level);
    }

    // NEW: Filter by multiple levels
    static filterByLevels(entries: LorebookEntry[], levels: LorebookLevel[]): LorebookEntry[] {
        return entries.filter(entry => levels.includes(entry.level));
    }

    // NEW: Get global entries only
    static getGlobalEntries(entries: LorebookEntry[]): LorebookEntry[] {
        return this.filterByLevel(entries, "global");
    }

    // NEW: Get series entries for specific series
    static getSeriesEntries(entries: LorebookEntry[], seriesId: string): LorebookEntry[] {
        return entries.filter(entry => entry.level === "series" && entry.scopeId === seriesId);
    }

    // NEW: Get story entries for specific story
    static getStoryEntries(entries: LorebookEntry[], storyId: string): LorebookEntry[] {
        return entries.filter(entry => entry.level === "story" && entry.scopeId === storyId);
    }

    // NEW: Get inherited entries (global + series, excluding story-specific)
    static getInheritedEntries(entries: LorebookEntry[], seriesId?: string): LorebookEntry[] {
        const global = this.getGlobalEntries(entries);

        if (seriesId) {
            const series = this.getSeriesEntries(entries, seriesId);
            return [...global, ...series];
        }

        return global;
    }

    // NEW: Separate entries by level for display
    static separateByLevel(entries: LorebookEntry[]): {
        global: LorebookEntry[];
        series: LorebookEntry[];
        story: LorebookEntry[];
    } {
        return {
            global: this.filterByLevel(entries, "global"),
            series: this.filterByLevel(entries, "series"),
            story: this.filterByLevel(entries, "story")
        };
    }

    // NEW: Get editable entries for a given context
    static getEditableEntries(entries: LorebookEntry[], editLevel: LorebookLevel, scopeId?: string): LorebookEntry[] {
        if (editLevel === "global") {
            return this.getGlobalEntries(entries);
        }

        if (editLevel === "series" && scopeId) {
            return this.getSeriesEntries(entries, scopeId);
        }

        if (editLevel === "story" && scopeId) {
            return this.getStoryEntries(entries, scopeId);
        }

        return [];
    }

    // ENHANCED: Match entries by text with level awareness
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
        if (options.levels) {
            filtered = this.filterByLevels(filtered, options.levels);
        }

        // Filter out disabled unless specified
        if (!options.includeDisabled) {
            filtered = this.filterActive(filtered);
        }

        // Match tags in text
        const lowerText = text.toLowerCase();
        return filtered.filter(entry => entry.tags.some(tag => lowerText.includes(tag.toLowerCase())));
    }
}

// Utility function exports for convenience
export const filterByLevel = LorebookFilterService.filterByLevel.bind(LorebookFilterService);
export const getInheritedEntries = LorebookFilterService.getInheritedEntries.bind(LorebookFilterService);
export const separateByLevel = LorebookFilterService.separateByLevel.bind(LorebookFilterService);
export const matchEntriesInText = LorebookFilterService.matchEntriesInText.bind(LorebookFilterService);
```

### 2. Add Custom Hooks for Common Filters (Optional)

```typescript
// In src/features/lorebook/hooks/useLorebookFilters.ts
import { useMemo } from "react";
import { LorebookFilterService } from "@/services/lorebook/lorebookFilters";
import type { LorebookEntry, LorebookLevel, LorebookCategory } from "@/types/entities";

export const useFilteredLorebook = (
    entries: LorebookEntry[] | undefined,
    filters: {
        level?: LorebookLevel;
        levels?: LorebookLevel[];
        category?: LorebookCategory;
        activeOnly?: boolean;
    }
) => {
    return useMemo(() => {
        if (!entries) return [];

        let filtered = entries;

        if (filters.level) {
            filtered = LorebookFilterService.filterByLevel(filtered, filters.level);
        }

        if (filters.levels) {
            filtered = LorebookFilterService.filterByLevels(filtered, filters.levels);
        }

        if (filters.category) {
            filtered = LorebookFilterService.filterByCategory(filtered, filters.category);
        }

        if (filters.activeOnly) {
            filtered = LorebookFilterService.filterActive(filtered);
        }

        return filtered;
    }, [entries, filters]);
};

export const useSeparatedLorebook = (entries: LorebookEntry[] | undefined) => {
    return useMemo(() => {
        if (!entries) return { global: [], series: [], story: [] };
        return LorebookFilterService.separateByLevel(entries);
    }, [entries]);
};
```

### 3. Update Lexical Tag Autocomplete (if needed)

If tag autocomplete plugin uses filter service:

```typescript
// In LorebookTagPlugin.tsx

const getAvailableTags = (entries: LorebookEntry[]): string[] => {
    // Include tags from all levels (global + series + story)
    // Already works if using hierarchical query, but can be explicit:
    const allTags = entries.flatMap(entry => entry.tags);
    return [...new Set(allTags)]; // Deduplicate
};
```

### 4. Usage Examples

```typescript
// In a component
import { LorebookFilterService } from "@/services/lorebook/lorebookFilters";

// Get only global entries
const globalEntries = LorebookFilterService.getGlobalEntries(allEntries);

// Get inherited entries (global + series)
const inheritedEntries = LorebookFilterService.getInheritedEntries(allEntries, seriesId);

// Separate by level for display
const { global, series, story } = LorebookFilterService.separateByLevel(allEntries);

// Match in text with level filter
const matchedGlobal = LorebookFilterService.matchEntriesInText(allEntries, chapterText, { levels: ["global"] });

// Get editable entries for current context
const editableEntries = LorebookFilterService.getEditableEntries(allEntries, "story", storyId);
```

## Service Summary

After implementation:

**New Methods:**

- `filterByLevel(entries, level)` - Filter by single level
- `filterByLevels(entries, levels)` - Filter by multiple levels
- `getGlobalEntries(entries)` - Get global entries only
- `getSeriesEntries(entries, seriesId)` - Get series entries for ID
- `getStoryEntries(entries, storyId)` - Get story entries for ID
- `getInheritedEntries(entries, seriesId?)` - Get global + series
- `separateByLevel(entries)` - Split into global/series/story objects
- `getEditableEntries(entries, level, scopeId)` - Get editable for context

**Enhanced Methods:**

- `matchEntriesInText(entries, text, options)` - Added level filtering option

**Existing Methods** (unchanged):

- `filterByCategory(entries, category)`
- `filterByTags(entries, tags)`
- `filterActive(entries)`

## Validation

- `filterByLevel` correctly filters by level
- `getInheritedEntries` returns global only when no seriesId
- `getInheritedEntries` returns global + series when seriesId provided
- `separateByLevel` correctly splits entries into three arrays
- `matchEntriesInText` respects level filter option
- `getEditableEntries` returns correct subset based on edit context

## Notes

- All methods pure functions (no side effects)
- Chainable for complex filtering scenarios
- Reusable across components and services
- Custom hooks optional but improve performance (memoization)
