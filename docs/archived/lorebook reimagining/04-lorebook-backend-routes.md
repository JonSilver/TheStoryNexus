# Task 04: Lorebook Backend Routes - Level-Based Queries

## Objective

Add level-based query endpoints to existing lorebook routes, including hierarchical query for story context.

## Context

- Extend existing lorebook routes to support global/series/story level filtering
- Add critical hierarchical endpoint for prompt context building
- Maintain existing endpoints for backward compatibility

## Dependencies

- **Task 01**: Database schema with level/scopeId fields
- **Task 02**: Updated LorebookEntry type

## File Locations

- **Modify**: `server/routes/lorebook.ts`

## Implementation Steps

### 1. Add Level-Based Query Endpoints

Add to existing `server/routes/lorebook.ts`:

```typescript
import { or } from "drizzle-orm";

// GET /lorebook/global - Get all global entries
lorebookRouter.get("/global", async (req, res) => {
    try {
        const entries = await db
            .select()
            .from(lorebookEntries)
            .where(eq(lorebookEntries.level, "global"))
            .orderBy(lorebookEntries.createdAt);
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch global lorebook" });
    }
});

// GET /lorebook/series/:seriesId - Get series-level entries
lorebookRouter.get("/series/:seriesId", async (req, res) => {
    try {
        const entries = await db
            .select()
            .from(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, req.params.seriesId)))
            .orderBy(lorebookEntries.createdAt);
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch series lorebook" });
    }
});

// GET /lorebook/story/:storyId - Get story-level entries only
lorebookRouter.get("/story/:storyId", async (req, res) => {
    try {
        const entries = await db
            .select()
            .from(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "story"), eq(lorebookEntries.scopeId, req.params.storyId)))
            .orderBy(lorebookEntries.createdAt);
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch story lorebook" });
    }
});

// GET /lorebook/story/:storyId/hierarchical - Get global + series + story entries
lorebookRouter.get("/story/:storyId/hierarchical", async (req, res) => {
    try {
        const storyId = req.params.storyId;

        // 1. Fetch the story to check if it belongs to a series
        const storyResult = await db.select().from(stories).where(eq(stories.id, storyId));
        if (storyResult.length === 0) {
            return res.status(404).json({ error: "Story not found" });
        }
        const story = storyResult[0];

        // 2. Build query conditions: global + story-level, optionally + series-level
        const conditions = [
            eq(lorebookEntries.level, "global"),
            and(eq(lorebookEntries.level, "story"), eq(lorebookEntries.scopeId, storyId))
        ];

        if (story.seriesId) {
            conditions.push(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, story.seriesId)));
        }

        // 3. Execute unified query
        const entries = await db
            .select()
            .from(lorebookEntries)
            .where(or(...conditions))
            .orderBy(lorebookEntries.level, lorebookEntries.createdAt);

        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch hierarchical lorebook" });
    }
});
```

### 2. Validate Create/Update Operations

Update existing POST/PUT endpoints to validate level/scopeId constraints:

```typescript
// In POST /lorebook
lorebookRouter.post("/", async (req, res) => {
    try {
        const { level, scopeId, name, description, category, tags, metadata, isDisabled, isDemo } = req.body;

        // Validate level/scopeId constraints
        if (level === "global" && scopeId) {
            return res.status(400).json({ error: "Global entries cannot have scopeId" });
        }
        if ((level === "series" || level === "story") && !scopeId) {
            return res.status(400).json({ error: `${level} entries require scopeId` });
        }

        const newEntry = {
            id: nanoid(),
            level,
            scopeId,
            storyId: level === "story" ? scopeId : "", // Temporary for Phase 1
            name,
            description,
            category,
            tags: JSON.stringify(tags),
            metadata: metadata ? JSON.stringify(metadata) : null,
            isDisabled: isDisabled || false,
            createdAt: new Date(),
            isDemo: isDemo || false
        };

        await db.insert(lorebookEntries).values(newEntry);
        res.status(201).json(newEntry);
    } catch (error) {
        res.status(500).json({ error: "Failed to create lorebook entry" });
    }
});

// Similar validation in PUT /lorebook/:id
```

### 3. Note on Default GET Endpoint

The default `GET /lorebook` endpoint returns ALL entries (massive dump). Either:

- **Option A**: Override to require level filter parameter
- **Option B**: Document as deprecated, direct users to level-specific endpoints
- **Option C**: Keep for admin/debugging purposes

Recommend **Option B** - keep but document not for production use.

## New API Endpoints Summary

After implementation:

- `GET /api/lorebook/global` - All global entries
- `GET /api/lorebook/series/:seriesId` - Series-level entries
- `GET /api/lorebook/story/:storyId` - Story-level entries only
- `GET /api/lorebook/story/:storyId/hierarchical` - **CRITICAL** - Global + series + story entries for prompt context

## Validation

- Test each level-based endpoint returns correct entries
- Test hierarchical endpoint:
    - For story without series: returns global + story entries
    - For story with series: returns global + series + story entries
- Verify validation rejects invalid level/scopeId combinations
- Test that disabled entries are included (filtering happens in application layer)

## Notes

- **Hierarchical endpoint is CRITICAL** - used by prompt parser for AI context building
- Keep existing storyId-based queries working during Phase 1
- Do NOT add FK constraints on scopeId (application handles referential integrity)
