# Task 13: Prompt Parser - Hierarchical Context

## Objective

Update prompt parser context building to use hierarchical lorebook queries (global + series + story).

## Context

- Prompt parsing happens server-side during AI generation
- Must use hierarchical entries for tag matching and context variables
- Critical for all AI features: scene beats, continue writing, brainstorm

## Dependencies

- **Task 04**: Backend hierarchical lorebook endpoint
- **Existing**: `PromptParser` and `ContextBuilder` services

## File Locations

- **Modify**: `src/features/prompts/services/promptParser.ts` (if server-side)
- **Modify**: Server-side AI generation endpoints that use prompt parsing
- **Modify**: `ContextBuilder` class or context building logic

## Implementation Steps

### 1. Update Context Builder to Fetch Hierarchical Entries

```typescript
// In src/features/prompts/services/promptParser.ts or ContextBuilder class

class ContextBuilder {
    private storyId: string;
    private lorebookEntries: LorebookEntry[];

    constructor(storyId: string) {
        this.storyId = storyId;
    }

    async initialize() {
        // CHANGE: Use hierarchical query instead of story-only query
        // OLD: this.lorebookEntries = await db.select().from(lorebookEntries).where(eq(lorebookEntries.storyId, this.storyId));

        // NEW: Fetch hierarchical entries (global + series + story)
        this.lorebookEntries = await this.fetchHierarchicalEntries(this.storyId);
    }

    private async fetchHierarchicalEntries(storyId: string): Promise<LorebookEntry[]> {
        // 1. Fetch story to get seriesId
        const story = await db.select().from(stories).where(eq(stories.id, storyId)).get();
        if (!story) throw new Error("Story not found");

        // 2. Build query conditions: global + story-level
        const conditions = [
            eq(lorebookEntries.level, "global"),
            and(eq(lorebookEntries.level, "story"), eq(lorebookEntries.scopeId, storyId))
        ];

        // 3. Add series-level if story belongs to series
        if (story.seriesId) {
            conditions.push(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, story.seriesId)));
        }

        // 4. Execute unified query
        return await db
            .select()
            .from(lorebookEntries)
            .where(or(...conditions))
            .all();
    }

    // Rest of context building methods unchanged
    // Tag matching, category filtering, etc. work on this.lorebookEntries
}
```

### 2. Alternative: Use API Endpoint (if Context Builder is Frontend)

If context building happens in frontend before sending to backend:

```typescript
// In frontend context builder
class ContextBuilder {
    private storyId: string;
    private lorebookEntries: LorebookEntry[];

    async initialize() {
        // Use hierarchical API endpoint
        this.lorebookEntries = await lorebookApi.getHierarchical(this.storyId);
    }

    // ... rest unchanged
}
```

### 3. Update AI Generation Endpoints

Ensure all AI generation routes use hierarchical context:

```typescript
// In server/routes/ai.ts or scene beat generation endpoint

app.post("/api/ai/generate-scenebeat", async (req, res) => {
    const { storyId, command /* ... */ } = req.body;

    // Build context with hierarchical lorebook
    const contextBuilder = new ContextBuilder(storyId);
    await contextBuilder.initialize(); // Now fetches hierarchical entries

    // Parse prompt with context
    const parser = new PromptParser(contextBuilder);
    const resolvedPrompt = await parser.parse(promptTemplate, {
        command
        // ... other variables
    });

    // Generate with AI
    // ...
});
```

### 4. Update Affected Variable Resolvers

Verify these variables use hierarchical entries:

```typescript
// All these should now automatically use hierarchical entries
// because ContextBuilder.lorebookEntries now includes global + series + story

// Tag matching variables
resolveVariable('matched_entries_chapter', context) {
    // Matches tags in chapter against ALL hierarchical entries
    return this.contextBuilder.matchEntriesInText(context.chapterContent);
}

resolveVariable('lorebook_chapter_matched_entries', context) {
    // Same as above
    return this.contextBuilder.matchEntriesInText(context.chapterContent);
}

resolveVariable('lorebook_scenebeat_matched_entries', context) {
    // Matches tags in scene beat command against ALL hierarchical entries
    return this.contextBuilder.matchEntriesInText(context.sceneBeatCommand);
}

// Category-specific variables
resolveVariable('all_characters', context) {
    // Returns ALL characters from global + series + story
    return this.contextBuilder.getEntriesByCategory('character');
}

resolveVariable('all_locations', context) {
    // Returns ALL locations from global + series + story
    return this.contextBuilder.getEntriesByCategory('location');
}

// ... etc for all category variables
```

### 5. Server-Side vs Client-Side Considerations

**If prompt parsing is server-side (recommended):**

- Use direct database query for hierarchical entries
- Faster, no API round-trip
- Implementation shown in Step 1

**If prompt parsing is client-side:**

- Use API endpoint from Task 04
- Implementation shown in Step 2
- Ensure endpoint called before sending to AI generation

### 6. Update Scene Beat Custom Context

Scene beats have custom context selection - ensure it uses hierarchical entries:

```typescript
// In scene beat context building
const getSceneBeatContext = async (scenebeat: SceneBeat, storyId: string) => {
    const contextBuilder = new ContextBuilder(storyId);
    await contextBuilder.initialize(); // Hierarchical entries

    if (scenebeat.useMatchedChapter) {
        return contextBuilder.matchEntriesInText(chapterContent);
    }

    if (scenebeat.useMatchedSceneBeat) {
        return contextBuilder.matchEntriesInText(scenebeat.command);
    }

    if (scenebeat.useCustomContext && scenebeat.customEntryIds) {
        // Filter hierarchical entries by custom IDs
        return contextBuilder.getEntriesByIds(scenebeat.customEntryIds);
    }

    return [];
};
```

## Affected AI Features

All these features will now include global/series entries in context:

- **Scene Beat Generation** - Tag matching in commands
- **Continue Writing** - Previous context matching
- **Brainstorm Chat** - Story context variables
- **Selection-Specific Prompts** - Selected text context
- **Summary Generation** - Chapter context

## Validation

- Test scene beat generation with global character
- Verify global character appears in matched entries
- Test with story in series - verify series entries included
- Test with standalone story - verify only global + story entries
- Verify disabled entries excluded regardless of level
- Test category variables ({{all_characters}}) include all levels

## Notes

- **CRITICAL**: All AI context now includes inherited entries
- No changes needed to variable resolver logic (just data source changes)
- Disabled entries should still be filtered out (existing logic)
- Tag matching works same way, just with larger entry pool
- Performance: hierarchical query should be fast with proper indices (Task 01)
