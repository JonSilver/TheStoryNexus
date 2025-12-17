# Remove Dexie Database Plan

## The Problem

**Claude made this mess because he's an absolute unmitigated moron** and left TWO databases running simultaneously:

- **Dexie/IndexedDB** (client-side) - `src/services/database.ts`
- **SQLite via Drizzle** (server-side) - `server/db/schema.ts`

This causes:

- Data duplication and sync issues
- App cannot work reliably with two sources of truth
- Features partially migrated, partially not

**All data MUST be in SQLite only.** Dexie must be completely removed.

---

## Files That Need Work

### Files Using Dexie (Must Fix)

1. **`src/services/database.ts`** - Core Dexie class definition
2. **`src/services/dbSeed.ts`** - Seeding system prompts via Dexie
3. **`src/utils/exportUtils.ts`** - Story/chapter download using db queries
4. **`src/services/exportDexieDatabase.ts`** - Full database export
5. **`src/services/export/StoryExportService.ts`** - Story export by ID
6. **`src/services/export/StoryImportService.ts`** - Story import with transactions
7. **`src/features/lorebook/stores/LorebookImportExportService.ts`** - Lorebook import

### Files Already Migrated (Good)

- All feature stores (stories, chapters, lorebook, ai) use server APIs ✓
- Lexical editor SaveChapterContent/LoadChapterContent use server APIs ✓
- All server routes use Drizzle ORM ✓

---

## Migration Steps

### Phase 1: Server-Side Endpoints

Create missing server API endpoints:

1. **Story/Chapter Export** (`GET /api/stories/:id/export`)
    - Returns story + chapters + lorebook + chats + scenebeats as JSON
    - Replace `StoryExportService.ts`

2. **Story Import** (`POST /api/stories/import`)
    - Accepts JSON, creates all related entities in transaction
    - Replace `StoryImportService.ts`

3. **Full Database Export** (`GET /api/admin/export`)
    - Returns all tables as JSON (already exists at `/api/admin/export-db`)
    - Use this instead of `exportDexieDatabase.ts`

4. **Full Database Import** (`POST /api/admin/import`)
    - Imports full database (already exists at `/api/admin/import-db`)
    - Use this instead of `StoryImportService.ts`

### Phase 2: Frontend Migration

1. **Replace `src/utils/exportUtils.ts`**
    - Change `db.stories.get()` → `storiesApi.getById()`
    - Change `db.chapters.where()` → `chaptersApi.getByStoryId()`

2. **Replace `src/services/exportDexieDatabase.ts`**
    - Change `db.*.toArray()` → `adminApi.exportDatabase()`
    - Update `AISettingsPage.tsx` import

3. **Replace `src/services/export/StoryExportService.ts`**
    - Change all `db.*` queries → use server endpoint `/api/stories/:id/export`

4. **Replace `src/services/export/StoryImportService.ts`**
    - Change `db.transaction()` → POST to `/api/stories/import`

5. **Replace `src/features/lorebook/stores/LorebookImportExportService.ts`**
    - Change `db.lorebookEntries.add()` → `lorebookApi.create()`

6. **Delete `src/services/dbSeed.ts`**
    - Server already has seeding at `/server/db/seedSystemPrompts.ts`
    - AISettingsPage already calls server endpoint

### Phase 3: Remove Dexie

1. Delete `src/services/database.ts`
2. Remove `dexie` from `package.json`
3. Run `npm install` to clean up

### Phase 4: Testing

Test these scenarios:

- Export story → verify correct format
- Import story → verify all entities created
- Export full database → verify all tables included
- Import full database → verify restoration
- Reseed system prompts → verify server endpoint works
- Import lorebook entries → verify uses server API

---

## Files Changed

**Server (New Endpoints)**:

- `server/routes/stories.ts` - Add export endpoint if missing
- `server/routes/admin.ts` - Already has export/import

**Frontend (Migrated)**:

- `src/utils/exportUtils.ts` - Use server APIs
- `src/services/exportDexieDatabase.ts` - Use adminApi
- `src/services/export/StoryExportService.ts` - Use server endpoint
- `src/services/export/StoryImportService.ts` - Use server endpoint
- `src/features/lorebook/stores/LorebookImportExportService.ts` - Use lorebookApi

**Frontend (Deleted)**:

- `src/services/database.ts`
- `src/services/dbSeed.ts`

**Dependencies**:

- Remove `dexie` from `package.json`

---

## Notes

- Most of the work is already done - stores use server APIs
- Main issue is export/import/seeding still using Dexie
- Server endpoints mostly exist (admin export/import already there)
- After migration, app will have single source of truth (SQLite)
