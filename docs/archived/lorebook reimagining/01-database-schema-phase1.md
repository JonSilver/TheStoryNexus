# Task 01: Database Schema Phase 1 - Add Hierarchy Support

## Objective

Create series table and add level/scopeId fields to existing tables while maintaining backward compatibility.

## Context

- First phase of two-phase migration strategy
- Keeps existing `storyId` field on lorebookEntries temporarily
- Enables verification before final schema in Phase 2

## Dependencies

- None (first task)

## File Locations

- **Schema**: `server/db/schema.ts`
- **Migration**: Generate with `npm run db:generate`, then manually edit SQL

## Implementation Steps

### 1. Create Series Table

Add to `server/db/schema.ts`:

```typescript
export const series = sqliteTable(
    "series",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        description: text("description"),
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        nameIdx: index("series_name_idx").on(table.name),
        createdAtIdx: index("series_created_at_idx").on(table.createdAt)
    })
);
```

### 2. Modify Stories Table

Add optional series reference:

```typescript
export const stories = sqliteTable(
    "stories",
    {
        // ... existing fields
        seriesId: text("seriesId").references(() => series.id, { onDelete: "set null" })
        // ... rest unchanged
    },
    table => ({
        // ... existing indices
        seriesIdIdx: index("story_series_id_idx").on(table.seriesId)
    })
);
```

### 3. Modify LorebookEntries Table

Add level/scopeId while keeping storyId:

```typescript
export const lorebookEntries = sqliteTable(
    "lorebookEntries",
    {
        id: text("id").primaryKey(),
        storyId: text("storyId").notNull(), // KEEP temporarily
        level: text("level").notNull().default("story"), // NEW
        scopeId: text("scopeId"), // NEW
        name: text("name").notNull(),
        description: text("description").notNull(),
        category: text("category").notNull(),
        tags: text("tags", { mode: "json" }).notNull(),
        metadata: text("metadata", { mode: "json" }),
        isDisabled: integer("isDisabled", { mode: "boolean" }),
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        storyIdIdx: index("lorebook_story_id_idx").on(table.storyId), // Keep
        levelIdx: index("lorebook_level_idx").on(table.level), // NEW
        scopeIdIdx: index("lorebook_scope_id_idx").on(table.scopeId), // NEW
        levelScopeIdx: index("lorebook_level_scope_idx").on(table.level, table.scopeId), // NEW
        categoryIdx: index("lorebook_category_idx").on(table.category),
        nameIdx: index("lorebook_name_idx").on(table.name)
    })
);
```

### 4. Generate Migration

```bash
npm run db:generate
```

### 5. Edit Generated Migration

Manually add data transformation to generated SQL:

```sql
-- After auto-generated ALTER TABLE statements, add:
UPDATE lorebookEntries SET scopeId = storyId, level = 'story' WHERE storyId IS NOT NULL;
```

### 6. Apply Migration

```bash
npm run db:migrate
```

## Validation

- Verify all existing lorebook entries have `level='story'`
- Verify all existing lorebook entries have `scopeId` equal to their `storyId`
- Verify series table exists and is empty
- Verify stories can have null seriesId

## Notes

- Do NOT remove storyId in this phase
- Phase 2 (separate task) will remove storyId field
- All existing entries default to story-level scope
