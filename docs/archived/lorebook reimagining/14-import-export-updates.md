# Task 14: Import/Export Updates

## Objective

Update import/export services to handle level-based lorebook entries and new series/global export formats.

## Context

- Story export includes series metadata if applicable
- Series export includes all stories + series lorebook
- Global lorebook export for sharing templates
- Import validation for level/scopeId constraints

## Dependencies

- **Task 02**: Updated types with level/scopeId
- **Existing**: Import/export services

## File Locations

- **Modify**: Story export/import service
- **Create**: Series export/import functions
- **Create**: Global lorebook export/import functions

## Implementation Steps

### 1. Update Lorebook Entry Validation in Import

```typescript
// In lorebook import service (or validation utility)

const validateLorebookEntry = (entry: unknown): entry is LorebookEntry => {
    if (!entry || typeof entry !== "object") return false;

    const e = entry as Partial<LorebookEntry>;

    // Check required fields
    if (!e.name || !e.description || !e.category || !e.tags || !e.level) {
        return false;
    }

    // Validate level/scopeId constraints
    if (e.level === "global" && e.scopeId) {
        console.error("Global entry cannot have scopeId");
        return false;
    }

    if ((e.level === "series" || e.level === "story") && !e.scopeId) {
        console.error(`${e.level} entry requires scopeId`);
        return false;
    }

    // Validate level is valid enum value
    if (!["global", "series", "story"].includes(e.level)) {
        console.error(`Invalid level: ${e.level}`);
        return false;
    }

    return true;
};
```

### 2. Update Story Export Format

```typescript
// In src/services/export/storyExport.ts

export interface StoryExportFormat {
    version: string;
    type: "story";
    exportDate: string;
    story: Story;
    series?: Series; // NEW - include if story belongs to series
    chapters: Chapter[];
    lorebookEntries: LorebookEntry[]; // Now includes level/scopeId
    notes?: Note[];
    // ... other related entities
}

export const exportStory = async (storyId: string): Promise<StoryExportFormat> => {
    // Fetch story
    const story = await storiesApi.getById(storyId);

    // NEW: Fetch series if story belongs to one
    let series: Series | undefined;
    if (story.seriesId) {
        series = await seriesApi.getById(story.seriesId);
    }

    // Fetch chapters
    const chapters = await chaptersApi.getByStory(storyId);

    // Fetch ONLY story-level lorebook entries (not inherited)
    const lorebookEntries = await lorebookApi.getByStory(storyId);

    // Fetch notes
    const notes = await notesApi.getByStory(storyId);

    return {
        version: "1.0",
        type: "story",
        exportDate: new Date().toISOString(),
        story,
        series, // NEW - included if applicable
        chapters,
        lorebookEntries, // Includes level='story' and scopeId=storyId
        notes
    };
};
```

### 3. Update Story Import

```typescript
// In src/services/export/storyImport.ts

export const importStory = async (data: StoryExportFormat): Promise<string> => {
    // Validate format
    if (data.type !== "story" || data.version !== "1.0") {
        throw new Error("Invalid story export format");
    }

    // Create new story (generate new ID)
    const newStoryId = nanoid();
    const newStory = {
        ...data.story,
        id: newStoryId,
        createdAt: new Date(),
        seriesId: undefined // Don't import series relationship - user must manually assign
    };
    await storiesApi.create(newStory);

    // Import chapters
    for (const chapter of data.chapters) {
        await chaptersApi.create({
            ...chapter,
            id: nanoid(),
            storyId: newStoryId,
            createdAt: new Date()
        });
    }

    // Import lorebook entries (with level/scopeId)
    for (const entry of data.lorebookEntries) {
        // Validate entry has level field
        if (!validateLorebookEntry(entry)) {
            console.warn(`Skipping invalid lorebook entry: ${entry.name}`);
            continue;
        }

        await lorebookApi.create({
            ...entry,
            id: nanoid(),
            level: "story", // Force to story-level on import
            scopeId: newStoryId, // Assign to new story
            storyId: newStoryId, // Temporary for Phase 1
            createdAt: new Date()
        });
    }

    // Import notes
    for (const note of data.notes || []) {
        await notesApi.create({
            ...note,
            id: nanoid(),
            storyId: newStoryId,
            createdAt: new Date()
        });
    }

    return newStoryId;
};
```

### 4. Create Series Export Format

```typescript
// In src/services/export/seriesExport.ts

export interface SeriesExportFormat {
    version: string;
    type: "series";
    exportDate: string;
    series: Series;
    lorebookEntries: LorebookEntry[]; // Series-level only
    stories: StoryExportFormat[]; // Full story exports
}

export const exportSeries = async (seriesId: string): Promise<SeriesExportFormat> => {
    // Fetch series
    const series = await seriesApi.getById(seriesId);

    // Fetch series-level lorebook entries
    const lorebookEntries = await lorebookApi.getBySeries(seriesId);

    // Fetch all stories in series
    const seriesStories = await seriesApi.getStories(seriesId);

    // Export each story (full export)
    const stories: StoryExportFormat[] = [];
    for (const story of seriesStories) {
        const storyExport = await exportStory(story.id);
        stories.push(storyExport);
    }

    return {
        version: "1.0",
        type: "series",
        exportDate: new Date().toISOString(),
        series,
        lorebookEntries, // level='series', scopeId=seriesId
        stories
    };
};
```

### 5. Create Series Import

```typescript
// In src/services/export/seriesImport.ts

export const importSeries = async (data: SeriesExportFormat): Promise<string> => {
    if (data.type !== "series" || data.version !== "1.0") {
        throw new Error("Invalid series export format");
    }

    // Create new series
    const newSeriesId = nanoid();
    const newSeries = {
        ...data.series,
        id: newSeriesId,
        createdAt: new Date()
    };
    await seriesApi.create(newSeries);

    // Import series-level lorebook entries
    for (const entry of data.lorebookEntries) {
        if (!validateLorebookEntry(entry)) {
            console.warn(`Skipping invalid lorebook entry: ${entry.name}`);
            continue;
        }

        await lorebookApi.create({
            ...entry,
            id: nanoid(),
            level: "series",
            scopeId: newSeriesId,
            storyId: "", // Temporary for Phase 1
            createdAt: new Date()
        });
    }

    // Import stories
    for (const storyData of data.stories) {
        const newStoryId = await importStory(storyData);
        // Assign to series
        await storiesApi.update(newStoryId, { seriesId: newSeriesId });
    }

    return newSeriesId;
};
```

### 6. Create Global Lorebook Export

```typescript
// In src/services/export/globalLorebookExport.ts

export interface GlobalLorebookExportFormat {
    version: string;
    type: "global-lorebook";
    exportDate: string;
    lorebookEntries: LorebookEntry[];
}

export const exportGlobalLorebook = async (): Promise<GlobalLorebookExportFormat> => {
    const lorebookEntries = await lorebookApi.getGlobal();

    return {
        version: "1.0",
        type: "global-lorebook",
        exportDate: new Date().toISOString(),
        lorebookEntries // level='global', no scopeId
    };
};

export const importGlobalLorebook = async (data: GlobalLorebookExportFormat): Promise<void> => {
    if (data.type !== "global-lorebook" || data.version !== "1.0") {
        throw new Error("Invalid global lorebook export format");
    }

    for (const entry of data.lorebookEntries) {
        if (!validateLorebookEntry(entry)) {
            console.warn(`Skipping invalid lorebook entry: ${entry.name}`);
            continue;
        }

        await lorebookApi.create({
            ...entry,
            id: nanoid(),
            level: "global",
            scopeId: undefined,
            storyId: "", // Temporary for Phase 1
            createdAt: new Date()
        });
    }
};
```

### 7. Update UI Export Buttons

Add export options for series and global lorebook:

```typescript
// In GlobalLorebookPage.tsx
<Button onClick={async () => {
    const exportData = await exportGlobalLorebook();
    downloadJSON(exportData, 'global-lorebook.json');
}}>
    Export Global Lorebook
</Button>

// In SeriesDashboard.tsx
<Button onClick={async () => {
    const exportData = await exportSeries(seriesId);
    downloadJSON(exportData, `${series.name}-export.json`);
}}>
    Export Series
</Button>
```

## Export Format Summary

**Story Export** (includes series metadata if applicable):

```json
{
    "version": "1.0",
    "type": "story",
    "exportDate": "2025-01-01T00:00:00.000Z",
    "story": {
        /* story data with seriesId */
    },
    "series": {
        /* series metadata if applicable */
    },
    "chapters": [
        /* chapters */
    ],
    "lorebookEntries": [
        /* story-level entries only */
    ],
    "notes": [
        /* notes */
    ]
}
```

**Series Export** (includes all stories):

```json
{
    "version": "1.0",
    "type": "series",
    "exportDate": "2025-01-01T00:00:00.000Z",
    "series": {
        /* series data */
    },
    "lorebookEntries": [
        /* series-level entries */
    ],
    "stories": [
        /* array of full story exports */
    ]
}
```

**Global Lorebook Export**:

```json
{
    "version": "1.0",
    "type": "global-lorebook",
    "exportDate": "2025-01-01T00:00:00.000Z",
    "lorebookEntries": [
        /* global entries */
    ]
}
```

## Validation

- Story export includes level/scopeId fields in lorebook entries
- Story export includes series metadata if story belongs to series
- Story import validates level/scopeId constraints
- Story import forces entries to story level (no importing global entries via story)
- Series export includes series lorebook + all stories
- Series import creates series, entries, and stories with correct relationships
- Global lorebook export/import handles global entries only
- Validation rejects entries with invalid level/scopeId combinations

## Notes

- Story import does NOT preserve series relationship (user must manually assign)
- Series import creates entire hierarchy (series + entries + stories)
- Global lorebook useful for sharing character templates, world templates
- Phase 1: Include storyId temporarily in imported entries
- Phase 2: Remove storyId field from export/import logic
