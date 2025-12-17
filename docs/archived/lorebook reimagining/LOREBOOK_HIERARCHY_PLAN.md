# Lorebook Hierarchy Plan: Global, Series & Story Scopes

## Overview

Extend lorebook architecture to support three-tier hierarchy:

- **Global** - Available to all stories
- **Series** - Available to all stories in a series
- **Story** - Available to single story only

Enables reusable character casts, locations, and lore across multiple stories.

## Architecture Context

This plan uses the current application stack:

- **Backend**: Express.js + Drizzle ORM + SQLite
- **Frontend**: React + TanStack Query
- **Patterns**: REST API with CRUD factory, query hooks with cache invalidation

Previous Tauri/Dexie/Zustand architecture has been migrated to web app architecture.

---

## Database Schema Changes (Drizzle ORM)

### New `series` table

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

### Modified `stories` table

Add optional series relationship with cascade rules:

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

**New field:**

- `seriesId?: string` - References series.id, sets to null when series deleted

### Modified `lorebookEntries` table

Change from story-only to level-based with unified scope reference.

**Target schema (Phase 2 final state):**

```typescript
export const lorebookEntries = sqliteTable(
    "lorebookEntries",
    {
        id: text("id").primaryKey(),
        level: text("level").notNull(), // 'global' | 'series' | 'story'
        scopeId: text("scopeId"), // seriesId or storyId depending on level
        name: text("name").notNull(),
        description: text("description").notNull(),
        category: text("category").notNull(),
        tags: text("tags", { mode: "json" }).notNull(), // JSON: string[]
        metadata: text("metadata", { mode: "json" }),
        isDisabled: integer("isDisabled", { mode: "boolean" }),
        createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
        isDemo: integer("isDemo", { mode: "boolean" })
    },
    table => ({
        levelIdx: index("lorebook_level_idx").on(table.level),
        scopeIdIdx: index("lorebook_scope_id_idx").on(table.scopeId),
        levelScopeIdx: index("lorebook_level_scope_idx").on(table.level, table.scopeId),
        categoryIdx: index("lorebook_category_idx").on(table.category),
        nameIdx: index("lorebook_name_idx").on(table.name)
    })
);
```

**Key changes:**

- Remove `storyId` foreign key constraint (now handled by application logic)
- Add `level` field: `'global' | 'series' | 'story'`
- Add `scopeId` field: contains seriesId or storyId based on level
- Add composite index on `level + scopeId` for efficient queries

**Benefits:**

- Single field for scope reference (cleaner schema)
- Enables promotion/demotion: just change `level` and update `scopeId`
- Simpler validation logic
- No cascade constraints needed (application handles deletion logic)

**Note:** Two-phase migration used to reach this schema. Phase 1 keeps `storyId` alongside new fields for safety. See Migration Strategy section.

---

## Type Definitions

### New Types

**Series:**

```typescript
export interface Series extends BaseEntity {
    name: string;
    description?: string;
}
```

### Modified Types

**LorebookEntry:**

```typescript
export interface LorebookEntry extends BaseEntity {
    level: "global" | "series" | "story";
    scopeId?: string; // seriesId when level='series', storyId when level='story', undefined when level='global'
    name: string;
    description: string;
    category: "character" | "location" | "item" | "event" | "note" | "synopsis" | "starting scenario" | "timeline";
    tags: string[];
    metadata?: {
        /* unchanged */
    };
    isDisabled?: boolean;
}
```

**Story:**

```typescript
export interface Story extends BaseEntity {
    title: string;
    author: string;
    language: string;
    synopsis?: string;
    seriesId?: string; // NEW
}
```

**StoryExport:**

```typescript
export interface StoryExport {
    // ... existing fields
    series?: Series; // Include if story belongs to series
}
```

---

## Server Routes (Express + Drizzle)

### New Series Routes (`server/routes/series.ts`)

Use CRUD factory with custom routes in `customRoutes` callback:

**Standard CRUD (provided by factory):**

- `GET /series`, `GET /series/:id`, `POST /series`, `PUT /series/:id`

**Custom routes to add:**

- `GET /series/:id/stories` - Fetch stories where `seriesId = :id`
- `GET /series/:id/lorebook` - Fetch entries where `level='series'` and `scopeId = :id`
- `DELETE /series/:id` - Override to:
    1. Orphan stories (set `seriesId = null`)
    2. Delete series-level lorebook entries
    3. Delete series itself

### Modified Lorebook Routes (`server/routes/lorebook.ts`)

Add custom routes for level-based queries:

- `GET /lorebook/global` - Where `level='global'`
- `GET /lorebook/series/:seriesId` - Where `level='series'` and `scopeId = seriesId`
- `GET /lorebook/story/:storyId` - Where `level='story'` and `scopeId = storyId`
- `GET /lorebook/story/:storyId/hierarchical` - Fetch story, check `seriesId`, return global + series (if applicable) + story entries using `or()` conditions

**Note:** Default `GET /lorebook` returns ALL entries (massive dump). Either override or document not to use.

**Note:** Changing entry level (e.g., story → series) uses standard `PUT /lorebook/:id` with updated `level` and `scopeId` fields.

### Modified Story Routes (`server/routes/stories.ts`)

**CRITICAL:** Override DELETE to clean up lorebook entries:

- Query and delete entries where `level='story'` and `scopeId = storyId`
- THEN delete story (which cascades chapters, aiChats, etc via FK)
- Without this, story deletion orphans lorebook entries (no FK cascade on lorebook)

---

## Frontend State Management (TanStack Query)

### New: Series Query Hooks (`src/features/series/hooks/useSeriesQuery.ts`)

Follow existing pattern from `useStoriesQuery.ts`:

- Query keys: `all`, `detail(id)`, `stories(id)`, `lorebook(id)`
- Queries: `useSeriesQuery`, `useSingleSeriesQuery`, `useSeriesStoriesQuery`
- Mutations: `useCreateSeriesMutation`, `useUpdateSeriesMutation`, `useDeleteSeriesMutation`
- Cache invalidation: series mutations invalidate series + stories queries

### Modified: Lorebook Query Hooks (`src/features/lorebook/hooks/useLorebookQuery.ts`)

Add level-based queries following existing pattern:

- New query keys: `global`, `series(id)`, `story(id)`, `hierarchical(id)`
- New queries: `useGlobalLorebookQuery`, `useSeriesLorebookQuery`, `useStoryLorebookQuery`, `useHierarchicalLorebookQuery`

**CRITICAL:** `useHierarchicalLorebookQuery` is what prompt context should use - gets global + series + story in one call.

**Note:** Level changes (story → series → global) handled by standard `useUpdateLorebookMutation` - just update `level` and `scopeId` fields.

### API Client Updates (`src/services/api/client.ts`)

Add `seriesApi` object (pattern: `getAll`, `getById`, `getStories`, `getLorebook`, `create`, `update`, `delete`)

Extend `lorebookApi` with level-based queries:

- `getGlobal()`, `getBySeries(seriesId)`, `getByStory(storyId)`, `getHierarchical(storyId)`

---

## Services

### Modified: `LorebookFilterService`

**Add:**

```typescript
filterByLevel(entries: LorebookEntry[], level: 'global' | 'series' | 'story'): LorebookEntry[]
getInheritedEntries(entries: LorebookEntry[], level: 'global' | 'series'): LorebookEntry[]
```

### Modified: `LorebookImportExportService`

**Import:**

- Validate `level` field present
- Validate `scopeId` present when level='series' or level='story'
- Validate `scopeId` absent when level='global'
- Reject entries with invalid level/scopeId combinations

**Export:**

- Include `level` field in JSON
- Include `scopeId` when applicable

### Modified: `PromptParser` / `ContextBuilder`

**Context building:**

- When resolving variables for story context, use hierarchical lorebook API endpoint (`/lorebook/story/:storyId/hierarchical`)
- Automatically includes global + series + story entries in matching
- No changes to variable resolver signatures

**Affected variables:**

- `{{matched_entries_chapter}}`
- `{{lorebook_chapter_matched_entries}}`
- `{{lorebook_scenebeat_matched_entries}}`
- `{{all_characters}}`, `{{all_locations}}`, etc.

All now implicitly include inherited entries.

**Implementation note:**
Prompt parsing happens server-side during AI generation. Server routes should fetch hierarchical entries and pass to prompt parser.

---

## Routing

### New Routes

**Series management:**

- `/series` - Series list page
- `/series/:seriesId` - Series dashboard (stories tab, metadata edit)

**Unified lorebook:**

- `/lorebook` - Main lorebook manager with level/scope selector at top
    - Level dropdown: Global | Series | Story
    - When Series selected: series dropdown appears
    - When Story selected: story dropdown appears
    - List shows filtered entries based on selection
    - Create/edit forms respect selected context

### Modified Routes

**Story routes:**

- `/dashboard/:storyId/lorebook` - Convenience shortcut to lorebook filtered by story
    - Pre-selects story in lorebook manager
    - Shows hierarchical view (inherited + story entries)
    - Create button defaults to story level

---

## UI Components

### New Components

**Series:**

- `SeriesListPage` - Series list with create/delete (reuse `StoryListPage` patterns)
- `SeriesDashboard` - View/edit series metadata, list stories in series
- `SeriesForm` - Name, description fields (AI context)

**Unified Lorebook Manager (`/lorebook`):**

- Top section: Level/scope selector
    - Level dropdown: Global | Series | Story
    - Conditional scope selector (series/story dropdown when level requires it)
    - Fetches appropriate entries based on selection
- Bottom section: Entry list + CRUD
    - Reuses existing `LorebookEntryList` component
    - Entry forms pre-populate level/scopeId from context
    - Single unified UI for all lorebook operations

**Shared:**

- `LevelBadge` - Visual indicator of entry level (colour-coded pill)

### Modified Components

**`LorebookPage` (story context shortcut):**

- Pre-select story from route param
- Fetch hierarchical entries (global + series + story)
- Show inherited entries with read-only badges
- Create button defaults to story level but changeable
- Essentially unified lorebook manager with pre-filtering

**`LorebookEntryForm`:**

- Add `level` dropdown (Global | Series | Story)
- Add conditional `scopeId` selector (series/story dropdown)
- Validation: scopeId required when level='series' or level='story'

**`LorebookEntryCard`:**

- Add `LevelBadge` display
- When viewing inherited entries (non-editable context), show read-only state

**`StoryForm`:**

- Add series dropdown (optional)
- "Assign to Series" select with "None" option

**Category-specific forms:**

- Character, Location, Item, Event, etc. - **no changes** (already generic)

### Component Reuse Strategy

**100% reusable (no changes):**

- All category-specific forms/cards
- Tag autocomplete logic
- Matching/filtering logic
- Entry list/card components
- Import/export UI

**Single lorebook UI with context:**

- `/lorebook` - Main manager, user selects context
- `/dashboard/:storyId/lorebook` - Same UI, pre-filtered to story
- Both routes render same `LorebookPage` component with different initial context

---

## Lorebook UI Behaviour

### Unified Manager (`/lorebook`)

User selects context via dropdowns:

- Level: Global | Series | Story
- Scope: (conditional dropdown for series/story selection)

List shows entries for selected context only. All entries editable in their own context.

### Story Context Shortcut (`/dashboard/:storyId/lorebook`)

Shows hierarchical view (inherited + story entries):

```
┌─────────────────────────────────┐
│ All Lorebook Entries            │
│ [Global] Character: John        │
│ [Series] Character: Detective X │
│ [Story]  Character: Villain Y [Edit] │
└─────────────────────────────────┘
```

**Editing rules:**

- Entries show level badges
- Click entry to edit: form opens with level/scopeId pre-filled
- Can edit any entry regardless of level (form redirects to appropriate context if needed)
- Or: disable edit button for non-story entries with tooltip "Edit in main lorebook manager"

**Simpler approach:** All entries editable from any view. Level/scope just determines which entries show by default.

### Tag Matching Behaviour

When matching `@tags` in chapter or scene beat, search across **all** inherited entries (global + series + story). Disabled entries excluded regardless of level.

---

## Implementation Notes

### Validation Rules

**LorebookEntry validation:**

```typescript
if (level === "global") {
    assert(!scopeId);
}
if (level === "series") {
    assert(scopeId); // Must reference a series
}
if (level === "story") {
    assert(scopeId); // Must reference a story
}
```

### Migration Strategy (Two-Phase)

Using two-phase migration to avoid SQLite `DROP COLUMN` complexity and allow verification between phases.

---

#### **Phase 1: Add New Fields (Keep storyId)**

**Schema changes (`server/db/schema.ts`):**

```typescript
// New series table
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

// Modified stories - add seriesId
export const stories = sqliteTable(
    "stories",
    {
        // ... existing fields
        seriesId: text("seriesId").references(() => series.id, { onDelete: "set null" })
        // ...
    },
    table => ({
        // ... existing indices
        seriesIdIdx: index("story_series_id_idx").on(table.seriesId)
    })
);

// Modified lorebookEntries - add level/scopeId, KEEP storyId temporarily
export const lorebookEntries = sqliteTable(
    "lorebookEntries",
    {
        id: text("id").primaryKey(),
        storyId: text("storyId").notNull(), // KEEP for now
        level: text("level").notNull().default("story"), // NEW
        scopeId: text("scopeId") // NEW
        // ... rest of fields unchanged
    },
    table => ({
        storyIdIdx: index("lorebook_story_id_idx").on(table.storyId), // Keep existing
        levelIdx: index("lorebook_level_idx").on(table.level), // NEW
        scopeIdIdx: index("lorebook_scope_id_idx").on(table.scopeId), // NEW
        levelScopeIdx: index("lorebook_level_scope_idx").on(table.level, table.scopeId) // NEW
        // ... other indices
    })
);
```

**Generate migration:**

```bash
npm run db:generate
```

**Edit generated migration SQL to add data transformation:**

```sql
-- Series table (auto-generated) ✓
CREATE TABLE series (...);

-- Stories seriesId (auto-generated) ✓
ALTER TABLE stories ADD COLUMN seriesId TEXT;
CREATE INDEX story_series_id_idx ON stories(seriesId);

-- Lorebook new columns (auto-generated) ✓
ALTER TABLE lorebookEntries ADD COLUMN level TEXT NOT NULL DEFAULT 'story';
ALTER TABLE lorebookEntries ADD COLUMN scopeId TEXT;
CREATE INDEX lorebook_level_idx ON lorebookEntries(level);
CREATE INDEX lorebook_scope_id_idx ON lorebookEntries(scopeId);
CREATE INDEX lorebook_level_scope_idx ON lorebookEntries(level, scopeId);

-- Data transformation (MANUALLY ADD) ✓
UPDATE lorebookEntries SET scopeId = storyId, level = 'story' WHERE storyId IS NOT NULL;
```

**Run migration:**

```bash
npm run db:migrate
```

**Deploy Phase 1:**

- Application works with both storyId (for old code) and level/scopeId (for new code)
- Verify all entries have correct level='story' and scopeId populated
- Test all features work with new fields

---

#### **Phase 2: Remove storyId (Later Release)**

Once Phase 1 verified and all code updated to use `level`/`scopeId`:

**Schema changes:**

```typescript
// lorebookEntries - remove storyId
export const lorebookEntries = sqliteTable(
    "lorebookEntries",
    {
        id: text("id").primaryKey(),
        // storyId removed
        level: text("level").notNull(),
        scopeId: text("scopeId")
        // ... rest unchanged
    },
    table => ({
        // storyIdIdx removed
        levelIdx: index("lorebook_level_idx").on(table.level),
        scopeIdIdx: index("lorebook_scope_id_idx").on(table.scopeId),
        levelScopeIdx: index("lorebook_level_scope_idx").on(table.level, table.scopeId)
        // ... other indices
    })
);
```

**Generate migration:**

```bash
npm run db:generate
```

Drizzle generates table recreation SQL (SQLite's way of dropping columns).

**Run migration:**

```bash
npm run db:migrate
```

**Benefits of two-phase:**

- Safe rollback if issues found in Phase 1
- Verify data transformation before committing
- Drizzle handles versioning automatically
- Users get migrations in sequence regardless of when they update

### Cascade Deletion (Covered in Routes Section)

No database FK cascade constraints on lorebook entries. Deletion handled in custom DELETE routes (see Server Routes section above).

### Import/Export

**Story export:**

- Include series metadata if `story.seriesId` present
- Include all story-scoped lorebook entries
- **Do not** include series or global entries (user must export series/global separately)

**Series export (new format):**

```json
{
    "version": "1.0",
    "type": "series",
    "exportDate": "...",
    "series": {
        /* series data */
    },
    "lorebookEntries": [
        /* series-scoped entries */
    ],
    "stories": [
        /* array of full story exports */
    ]
}
```

**Global export (new format):**

```json
{
    "version": "1.0",
    "type": "global-lorebook",
    "exportDate": "...",
    "lorebookEntries": [
        /* global entries */
    ]
}
```

---

## Component Architecture Summary

```
Features:
├── series/
│   ├── pages/
│   │   ├── SeriesListPage.tsx (NEW)
│   │   └── SeriesDashboard.tsx (NEW)
│   ├── components/
│   │   ├── SeriesForm.tsx (NEW)
│   │   └── SeriesCard.tsx (NEW)
│   └── hooks/
│       └── useSeriesQuery.ts (NEW: TanStack Query hooks)
│
├── lorebook/
│   ├── pages/
│   │   └── LorebookPage.tsx (MODIFIED: unified manager with level/scope selector)
│   ├── components/
│   │   ├── LorebookEntryCard.tsx (MODIFIED: level badge)
│   │   ├── LorebookEntryForm.tsx (MODIFIED: level + scope selectors)
│   │   ├── LevelScopeSelector.tsx (NEW: combined level/scope dropdown UI)
│   │   └── LevelBadge.tsx (NEW)
│   ├── hooks/
│   │   └── useLorebookQuery.ts (MODIFIED: level-based queries)
│   └── utils/
│       └── lorebookFilters.ts (MODIFIED: level filtering)
│
└── stories/
    ├── components/
    │   └── StoryForm.tsx (MODIFIED: series dropdown)
    └── hooks/
        └── useStoriesQuery.ts (EXISTING: no changes needed)
```

---

## Critical Implementation Issues

### 1. Prompt Parsing Must Use Hierarchical Queries

PromptParser runs server-side during AI generation. Must update to use hierarchical lorebook entries (global + series + story).

**Affected AI generation endpoints:**

- Scene beat generation
- Continue writing
- Brainstorm chat
- Selection-specific prompts

All must query hierarchical entries or call `/lorebook/story/:storyId/hierarchical` endpoint.

### 2. Existing Lorebook Code Assumes `storyId`

Multiple features assume required `storyId` field on lorebook entries:

- Lexical LorebookTagPlugin (tag autocomplete)
- Tag matching logic in chapter/scene beat context
- Scene beat custom context selection
- Export/import code

Plan changes `storyId` to optional `scopeId`. **Must comprehensively update all lorebook references.**

### 3. Zod Schemas

Add validation schemas to `src/schemas/entities.ts`:

- `Series` type
- Modified `LorebookEntry` (level/scopeId constraints)

Keep validation simple - UI enforces constraints, backend just needs basic checks.

---

## Key Benefits

1. **Character reuse** - Define protagonist once, use across trilogy
2. **Shared worldbuilding** - Locations, items, lore shared across series
3. **Global templates** - Common character archetypes available everywhere
4. **Clean separation** - Story-specific details isolated, shared lore inherited
5. **Minimal disruption** - Existing components largely reused, existing stories unaffected
