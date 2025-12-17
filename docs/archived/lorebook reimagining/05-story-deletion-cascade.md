# Task 05: Story Deletion - Lorebook Cascade

## Objective

Update story DELETE endpoint to properly clean up story-level lorebook entries.

## Context

- No FK cascade from stories to lorebookEntries (application handles deletion)
- Must manually delete story-level entries before deleting story
- Other story relations (chapters, aiChats, etc.) cascade via existing FK constraints

## Dependencies

- **Task 01**: Database schema with level/scopeId
- **Task 02**: Updated types

## File Locations

- **Modify**: `server/routes/stories.ts`

## Implementation Steps

### 1. Update Story DELETE Endpoint

Modify existing `DELETE /stories/:id` in `server/routes/stories.ts`:

```typescript
import { lorebookEntries } from "../db/schema.js";

// DELETE /stories/:id - Delete story with lorebook cascade
storiesRouter.delete("/:id", async (req, res) => {
    try {
        const storyId = req.params.id;

        // 1. Delete all story-level lorebook entries
        await db
            .delete(lorebookEntries)
            .where(and(eq(lorebookEntries.level, "story"), eq(lorebookEntries.scopeId, storyId)));

        // 2. Delete the story (FK cascades handle chapters, aiChats, notes, etc.)
        await db.delete(stories).where(eq(stories.id, storyId));

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Failed to delete story" });
    }
});
```

### 2. Add Transaction Support (Optional but Recommended)

Wrap deletion in transaction to ensure atomicity:

```typescript
storiesRouter.delete("/:id", async (req, res) => {
    try {
        const storyId = req.params.id;

        await db.transaction(async tx => {
            // 1. Delete story-level lorebook entries
            await tx
                .delete(lorebookEntries)
                .where(and(eq(lorebookEntries.level, "story"), eq(lorebookEntries.scopeId, storyId)));

            // 2. Delete story
            await tx.delete(stories).where(eq(stories.id, storyId));
        });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Failed to delete story" });
    }
});
```

### 3. Consider Bulk Delete (if exists)

If there's a bulk delete endpoint, apply same logic to each story ID.

## Cascade Behavior Summary

**Story deletion cascades:**

- ✅ Chapters (FK: `chapters.storyId → stories.id`)
- ✅ AI Chats (FK: `aiChats.storyId → stories.id`)
- ✅ Notes (FK: `notes.storyId → stories.id`)
- ✅ Scene Beats (FK via chapters)
- ✅ Story-level lorebook entries (application-level cascade in this task)

**Story deletion does NOT cascade:**

- Series membership (story.seriesId set to null when series deleted)

## Validation

- Create test story with multiple lorebook entries
- Delete story via API
- Verify:
    - Story deleted successfully
    - All story-level lorebook entries removed
    - Chapters, notes, aiChats also removed (existing FK behavior)
    - Global and series entries unaffected
- Test rollback: simulate database error mid-delete, verify nothing partially deleted (if using transactions)

## Notes

- **Critical**: Without this change, story deletion orphans lorebook entries
- Transaction support prevents partial deletion on errors
- Phase 1 maintains storyId field, so existing queries still work during migration
