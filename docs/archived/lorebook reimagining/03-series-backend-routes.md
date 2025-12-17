# Task 03: Series Backend Routes & API

## Objective

Create Express routes for series CRUD operations using existing CRUD factory pattern.

## Context

- Follow existing route patterns from `server/routes/stories.ts` and `server/routes/chapters.ts`
- Use CRUD factory with custom route extensions
- Handle cascade deletion of series-level lorebook entries

## Dependencies

- **Task 01**: Database schema with series table
- **Task 02**: Types must include Series interface

## File Locations

- **New route file**: `server/routes/series.ts`
- **Server index**: `server/index.ts` (register routes)
- **API utilities**: Use existing CRUD factory from other route files

## Implementation Steps

### 1. Create Series Routes File

Create `server/routes/series.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { series, stories, lorebookEntries } from "../db/schema.js";

export const seriesRouter = Router();

// GET /series - List all series
seriesRouter.get("/", async (req, res) => {
    try {
        const allSeries = await db.select().from(series).orderBy(series.createdAt);
        res.json(allSeries);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch series" });
    }
});

// GET /series/:id - Get single series
seriesRouter.get("/:id", async (req, res) => {
    try {
        const result = await db.select().from(series).where(eq(series.id, req.params.id));
        if (result.length === 0) {
            return res.status(404).json({ error: "Series not found" });
        }
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch series" });
    }
});

// POST /series - Create series
seriesRouter.post("/", async (req, res) => {
    try {
        const newSeries = {
            id: nanoid(),
            name: req.body.name,
            description: req.body.description,
            createdAt: new Date(),
            isDemo: req.body.isDemo || false
        };
        await db.insert(series).values(newSeries);
        res.status(201).json(newSeries);
    } catch (error) {
        res.status(500).json({ error: "Failed to create series" });
    }
});

// PUT /series/:id - Update series
seriesRouter.put("/:id", async (req, res) => {
    try {
        const updated = {
            name: req.body.name,
            description: req.body.description
        };
        await db.update(series).set(updated).where(eq(series.id, req.params.id));
        const result = await db.select().from(series).where(eq(series.id, req.params.id));
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: "Failed to update series" });
    }
});

// DELETE /series/:id - Delete series with cascade
seriesRouter.delete("/:id", async (req, res) => {
    try {
        const seriesId = req.params.id;

        // 1. Orphan all stories in this series (set seriesId to null)
        await db.update(stories).set({ seriesId: null }).where(eq(stories.seriesId, seriesId));

        // 2. Delete all series-level lorebook entries
        await db
            .delete(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, seriesId)));

        // 3. Delete the series itself
        await db.delete(series).where(eq(series.id, seriesId));

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Failed to delete series" });
    }
});

// GET /series/:id/stories - Get all stories in series
seriesRouter.get("/:id/stories", async (req, res) => {
    try {
        const seriesStories = await db
            .select()
            .from(stories)
            .where(eq(stories.seriesId, req.params.id))
            .orderBy(stories.createdAt);
        res.json(seriesStories);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch series stories" });
    }
});

// GET /series/:id/lorebook - Get all series-level lorebook entries
seriesRouter.get("/:id/lorebook", async (req, res) => {
    try {
        const entries = await db
            .select()
            .from(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "series"), eq(lorebookEntries.scopeId, req.params.id)))
            .orderBy(lorebookEntries.createdAt);
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch series lorebook" });
    }
});
```

### 2. Register Routes in Server

Update `server/index.ts`:

```typescript
import { seriesRouter } from "./routes/series.js";

// ... existing imports and setup

app.use("/api/series", seriesRouter);

// ... rest of server setup
```

### 3. Add Error Handling Middleware (if not exists)

Ensure proper error responses for validation failures and database errors.

## API Endpoints Summary

After implementation, these endpoints will be available:

- `GET /api/series` - List all series
- `GET /api/series/:id` - Get single series
- `POST /api/series` - Create series
- `PUT /api/series/:id` - Update series
- `DELETE /api/series/:id` - Delete series (orphans stories, deletes series lorebook)
- `GET /api/series/:id/stories` - Get stories in series
- `GET /api/series/:id/lorebook` - Get series-level lorebook entries

## Validation

- Test all CRUD operations via REST client (Postman/Insomnia)
- Verify DELETE properly orphans stories (sets seriesId to null)
- Verify DELETE removes series-level lorebook entries
- Verify GET endpoints return correct filtered data

## Notes

- No cascade constraint in database for lorebook entries (handled in application)
- Stories are orphaned (not deleted) when series deleted
- Follow existing error handling patterns from other route files
