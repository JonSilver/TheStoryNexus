# Tauri to Web App Migration - Progress Report

**Date:** 2025-11-04
**Session Tokens Used:** ~107k / 200k

## Completed

### Backend Infrastructure

- ✅ Express server with all API routes (stories, chapters, lorebook, prompts, AI, brainstorm, scenebeats, notes, admin)
- ✅ Drizzle ORM schema mirroring Dexie tables
- ✅ SQLite database with migrations
- ✅ Admin import endpoint (accepts JSON, replaces all data)
- ✅ Development workflow (concurrent server/client with tsx + vite)

### Frontend Infrastructure

- ✅ TanStack Query provider added to app root
- ✅ API client layer (`src/services/api/client.ts`)
- ✅ Query hooks for all features (stories, chapters, lorebook, prompts, AI, brainstorm, scenebeats, notes)
- ✅ Vite config updated (removed Tauri, added API proxy)

### Component Refactoring (Partial)

- ✅ Story components (5/5): Home, StoryDashboard, StoryCard, CreateStoryDialog, EditStoryDialog
- ✅ Chapter components (2/8): ChapterOutline, ChapterNotesEditor

## Remaining Work

### HIGH PRIORITY

1. **Backend Route Refactoring**
    - All route files have repetitive CRUD boilerplate
    - Need factory pattern or helper functions to DRY it up
    - ~500+ lines of duplicated code across 8 route files

2. **Migration Utilities**
    - Export: Read IndexedDB → download JSON (client-side utility)
    - Import: Upload JSON → SQLite (backend already done)
    - Add migration page/button to settings

3. **System Prompts Initialization**
    - Backend needs to seed system prompts on first run
    - Currently Dexie does this via `on('populate')` event
    - Need equivalent in backend startup

### MEDIUM PRIORITY

4. **Zustand → TanStack Query Replacement** (~25 files remaining)

    **Chapter components (6 left):**
    - ChapterEditorPage.tsx
    - Chapters.tsx
    - ChapterCard.tsx
    - ChapterPOVEditor.tsx
    - MatchedTagEntries.tsx

    **Lorebook (3 files):**
    - LorebookPage.tsx
    - LorebookEntryList.tsx
    - CreateEntryDialog.tsx

    **Brainstorm (3 files):**
    - BrainstormPage.tsx
    - ChatInterface.tsx
    - ChatList.tsx

    **Notes (2 files):**
    - NoteEditor.tsx
    - NoteList.tsx

    **Prompts (1 file):**
    - PromptForm.tsx

    **Lexical Editor (7 files):**
    - EmbeddedPlayground.tsx
    - SceneBeatNode.tsx
    - useSceneBeatGeneration.ts
    - FloatingTextFormatToolbarPlugin
    - LoadChapterContent plugin
    - LorebookTagPlugin
    - SaveChapterContent plugin

    **Prompt Parser (4 files):**
    - promptParser.ts
    - BrainstormResolvers.ts
    - ChapterResolvers.ts
    - LorebookResolvers.ts

### LOW PRIORITY

5. **Docker Setup**
    - Dockerfile
    - docker-compose.yml
    - Build scripts

6. **Tauri Removal**
    - Delete `src-tauri/` directory
    - Remove `@tauri-apps/cli` from package.json
    - Clean up any Tauri-specific config

7. **Testing**
    - Backend CRUD operations
    - Migration utilities (export/import)
    - Full integration test

## Critical Issues

1. **Backend routes are extremely repetitive** - every route file has near-identical CRUD patterns
2. **System prompts not initialized** - backend won't have default prompts on fresh database
3. **Many components still using Zustand stores** - app won't work until these are all replaced
4. **No migration utility UI yet** - can't actually migrate data from old app

## Recommended Next Steps

**Option A - Finish Foundation First:**

1. Refactor backend routes (DRY)
2. Add system prompts initialization
3. Add migration utilities
4. Test backend thoroughly
5. Continue Zustand replacement in next session

**Option B - Push Through Replacements:**

1. Finish all Zustand → TanStack Query replacements now
2. Do backend cleanup after
3. Add utilities last

**Option C - Minimum Viable:**

1. Refactor backend routes
2. Add migration utilities
3. Leave some Zustand replacements for follow-up
4. Test what works, document what doesn't
