# Lorebook Hierarchy Implementation - Task Overview

## Purpose

This directory contains individual implementation plans for adding three-tier lorebook hierarchy (Global/Series/Story) to The Story Nexus application.

## Key Architectural Decision: Unified Lorebook UI

**Important:** The UI implementation uses a **single unified lorebook manager** rather than three separate pages. This simplifies the UX significantly:

- **Main Manager** (`/lorebook`): Level/scope selector at top, user chooses context (Global/Series/Story)
- **Story Shortcut** (`/dashboard/:storyId/lorebook`): Same component, pre-filtered to story with inherited entries visible
- **No separate pages** for global or series lorebook - all managed through unified interface

This approach reuses 100% of existing lorebook components and provides consistent UX.

## Implementation Strategy

### Two-Phase Approach

1. **Phase 1 (Tasks 01-15)**: Add new hierarchy fields while keeping `storyId` for backward compatibility
2. **Phase 2 (Task 16)**: Remove `storyId` field after Phase 1 is stable and verified

This approach minimizes risk and allows rollback if issues are discovered.

## Task List & Dependencies

### Foundation (Tasks 01-02)

Start here - these are required by all other tasks:

- **Task 01**: Database Schema Phase 1
    - Create series table
    - Add level/scopeId to lorebookEntries (keep storyId temporarily)
    - Generate and run migration
    - Dependencies: None

- **Task 02**: Update TypeScript Types
    - Add Series interface
    - Update LorebookEntry with level/scopeId
    - Update Story with seriesId
    - Dependencies: Task 01

### Backend Implementation (Tasks 03-05)

Backend API routes and data layer:

- **Task 03**: Series Backend Routes
    - Create series CRUD endpoints
    - Series stories and lorebook queries
    - Custom delete with cascade
    - Dependencies: Tasks 01, 02

- **Task 04**: Lorebook Backend Routes - Level Queries
    - Add global/series/story query endpoints
    - **CRITICAL**: Add hierarchical query endpoint
    - Validation for level/scopeId constraints
    - Dependencies: Tasks 01, 02

- **Task 05**: Story Deletion - Lorebook Cascade
    - Update story DELETE to remove story-level lorebook entries
    - Prevent orphaned entries
    - Dependencies: Tasks 01, 02

### Frontend API Client (Task 06)

Bridge between backend and frontend:

- **Task 06**: API Client Updates
    - Add seriesApi methods
    - Extend lorebookApi with level-based queries
    - Dependencies: Tasks 02, 03, 04

### State Management (Tasks 07-08)

TanStack Query hooks for React:

- **Task 07**: Series Query Hooks
    - Series queries and mutations
    - Cache invalidation
    - Dependencies: Tasks 02, 06

- **Task 08**: Lorebook Query Hooks - Level Queries
    - Global/series/story queries
    - **CRITICAL**: Hierarchical query hook
    - Enhanced mutation cache invalidation
    - Dependencies: Tasks 02, 06

### UI Components (Tasks 09-12)

User interface implementation:

- **Task 09**: Series UI Components
    - SeriesListPage, SeriesDashboard
    - SeriesForm, SeriesCard
    - Routes and navigation (no lorebook tab)
    - Dependencies: Tasks 02, 07

- **Task 10**: Unified Lorebook Manager
    - Single page for global/series/story management
    - Level/scope selector UI
    - LevelBadge and LevelScopeSelector components
    - Used by both `/lorebook` and story shortcut routes
    - Dependencies: Task 08

- **Task 11**: Story Lorebook Routing
    - Add route for story lorebook shortcut
    - Uses unified manager from Task 10
    - Pre-filtered hierarchical view
    - Navigation integration in story dashboard
    - Dependencies: Task 10

- **Task 12**: Story Form - Series Selection
    - Add series dropdown to story create/edit
    - Optional: Series filter in story list
    - Dependencies: Tasks 02, 07

### Services & Context (Tasks 13-15)

Business logic and utilities:

- **Task 13**: Prompt Parser - Hierarchical Context
    - **CRITICAL**: Use hierarchical entries for AI context
    - Update all AI generation endpoints
    - Affects: scene beats, continue writing, brainstorm
    - Dependencies: Task 04

- **Task 14**: Import/Export Updates
    - Story export with series metadata
    - Series export format
    - Global lorebook export
    - Level/scopeId validation on import
    - Dependencies: Task 02

- **Task 15**: Filter Service Updates
    - Level-based filtering functions
    - Inherited entries helper
    - Separate by level utility
    - Dependencies: Task 02

### Phase 2 - Cleanup (Task 16)

**DO NOT START UNTIL PHASE 1 IS STABLE**

- **Task 16**: Remove storyId Field
    - Remove storyId from schema
    - Generate migration (table recreation)
    - Update types
    - Clean up temporary assignments
    - Dependencies: Tasks 01-15 completed and verified in production

## Critical Tasks

These tasks are **critical** for functionality and must be done correctly:

1. **Task 01** - Database migration must preserve all existing data
2. **Task 04** - Hierarchical endpoint is used by all AI features
3. **Task 08** - Hierarchical query hook connects UI to AI context
4. **Task 13** - Prompt parser must use hierarchical entries or AI context will be incomplete

## Recommended Implementation Order

### Sprint 1: Foundation & Backend

1. Task 01 - Database Schema Phase 1
2. Task 02 - Types
3. Task 03 - Series Routes
4. Task 04 - Lorebook Routes (includes critical hierarchical endpoint)
5. Task 05 - Story Deletion Cascade

### Sprint 2: Frontend State & API

6. Task 06 - API Client
7. Task 07 - Series Query Hooks
8. Task 08 - Lorebook Query Hooks

### Sprint 3: UI Components

9. Task 09 - Series UI (list, dashboard, forms)
10. Task 10 - Unified Lorebook Manager (single page for all levels)
11. Task 11 - Story Lorebook Routing (shortcut to unified manager)
12. Task 12 - Story Form Series Selection

### Sprint 4: Services & Integration

13. Task 15 - Filter Service (lightweight, can be done anytime)
14. Task 13 - Prompt Parser (critical, needs testing)
15. Task 14 - Import/Export

### Sprint 5 (Later): Cleanup

16. Task 16 - Phase 2 (only after 2+ weeks of stable Phase 1)

## Testing Strategy

### After Each Task

- Unit tests for new functions
- Integration tests for API endpoints
- Manual testing of related UI

### After Sprint 1 (Backend Complete)

- Test all CRUD operations via REST client
- Verify cascade deletion
- Verify hierarchical query returns correct data

### After Sprint 2 (State Management Complete)

- Test query hooks return correct data
- Test mutations trigger correct cache invalidations
- Test optimistic updates

### After Sprint 3 (UI Complete)

- Full user workflow testing
- Test unified lorebook manager with level/scope selector
- Create global/series/story entries via unified UI
- Test story lorebook shortcut shows inherited entries
- Verify level badges and read-only inherited entries
- Test series assignment in story form

### After Sprint 4 (Integration Complete)

- **CRITICAL**: Test AI features with hierarchical context
- Test scene beat generation with global character
- Test continue writing with series location
- Test import/export round-trip

### Before Phase 2

- Full regression test of all features
- Production soak test (2+ weeks minimum)
- Database backup verification

## Rollback Plan

### Phase 1 Issues

If issues found during Phase 1:

- All queries work with both storyId and level/scopeId during Phase 1
- Can fix bugs without rollback
- storyId field preserved for safety

### Phase 2 Issues

If issues found after Phase 2 migration:

1. Stop application
2. Restore database backup (made before Phase 2)
3. Revert code to Phase 1 version
4. Investigate and fix issues
5. Retry Phase 2 when ready

## Success Criteria

### Phase 1 Complete

- [ ] All 16 implementation plans completed (01-15, skip 16)
- [ ] All existing features still work
- [ ] Unified lorebook manager accessible at `/lorebook`
- [ ] Can create global/series/story entries via unified UI
- [ ] Level/scope selector works correctly
- [ ] Can create series and assign stories
- [ ] Story lorebook shortcut shows inherited entries (read-only) + story entries (editable)
- [ ] AI context includes global/series entries in hierarchical queries
- [ ] Import/export works with new formats
- [ ] Production stable for 2+ weeks

### Phase 2 Complete

- [ ] Database has no storyId column
- [ ] No code references storyId
- [ ] All features still work
- [ ] Production stable for 1+ month

## Notes

- Each task is designed to be given to an implementation agent
- Tasks include detailed code examples and validation steps
- Dependencies clearly marked - don't start dependent tasks early
- Critical tasks marked - pay extra attention to these
- Two-phase approach minimizes risk of data corruption
- Phase 2 is optional cleanup - system fully functional after Phase 1
