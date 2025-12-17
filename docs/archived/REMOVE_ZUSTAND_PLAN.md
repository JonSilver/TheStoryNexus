# Remove Zustand - Migration Plan

## The Problem

Four Zustand stores remain, misused for concerns better handled by TanStack Query, React state, or pure utility functions:

1. **useAIStore** - Duplicates TanStack Query state management, wraps service methods
2. **useLorebookStore** - Mixes UI state, derived data, and pure utilities
3. **useChapterStore** - Utility facade that fetches data (should be queries)
4. **useChapterContentStore** - Pure function wrapper (doesn't need state)

TanStack Query should be the single source of truth for server-derived state. React's built-in state primitives handle the rest.

---

## Migration Strategy

### Phase 1: AI State & Operations

**Current Issues:**

- `useAIStore` holds `settings` (server data) - duplicates what TanStack Query should manage
- Stores `isInitialized`, `isLoading`, `error` - TanStack Query provides these
- Wraps `AIService` methods in store actions - unnecessary indirection
- `generateWithParsedMessages` fetches prompt data inline - should be separate query

**Replacements:**

1. **AI Settings Query**
    - Create `useAISettingsQuery` hook (TanStack Query)
    - Provides `data`, `isLoading`, `error` automatically
    - Create `useUpdateAISettingsMutation` for updates
    - Invalidates settings cache on success

2. **AI Service Initialization**
    - Create `useAIServiceInit` custom hook
    - Calls `aiService.initialize()` once on mount
    - Returns initialization status
    - No global state needed - initialization is idempotent

3. **Model Management**
    - Create `useAvailableModelsQuery(provider?, forceRefresh?)`
    - Queries `AIService.getAvailableModels()`
    - TanStack Query handles caching, stale-while-revalidate
    - Force refresh via `refetch()`

4. **Generation Operations**
    - Move to custom hooks: `useAIGeneration`, `useStreamedGeneration`
    - Accept callbacks (onToken, onComplete, onError)
    - Use AIService directly - no state wrapper needed
    - Abort handling via cleanup functions

5. **Provider Key Updates**
    - `useUpdateProviderKeyMutation(provider, key)`
    - Calls `AIService.updateKey()`
    - Invalidates settings & models queries on success

**Migration Path:**

- Create all TanStack Query hooks first
- Create custom hooks for operations
- Update components to use new hooks
- Remove useAIStore
- Verify AIService singleton still works correctly

---

### Phase 2: Lorebook Utilities & State

**Current Issues:**

- `tagMap` is derived from entries - should be `useMemo` or Query's `select`
- `editorContent`, `matchedEntries`, `chapterMatchedEntries` are UI state - should be React state
- Filter utilities are pure functions - don't need a store
- Import/export are operations - should be service functions

**Replacements:**

1. **Tag Map (Derived State)**
    - Option A: Use `useMemo` with lorebook entries query
    - Option B: Add `select` to `useLorebookByStoryQuery` to transform data
    - Build tag map from query result, not stored separately

2. **Editor Content State**
    - Move to `useState` in components that need it
    - Likely only needed in specific editor/input contexts
    - Pass down via props or lift to nearest common ancestor

3. **Matched Entries State**
    - Move to `useState` in components using auto-matching
    - `matchedEntries` - current scene beat matches
    - `chapterMatchedEntries` - chapter-level matches
    - Compute on-demand from content, not stored globally

4. **Filter Utilities**
    - Extract pure functions to `src/features/lorebook/utils/lorebookFilters.ts`
    - All are stateless operations on arrays
    - Can be used directly without wrapping in hooks
    - Consider memoizing expensive filters with `useMemo` at call site

5. **Import/Export**
    - Already service classes (`LorebookImportExportService`)
    - Call directly from components
    - No state needed beyond operation feedback (loading/error/success)
    - Use mutation hooks if need to trigger cache invalidation

**Migration Path:**

- Extract filter utilities to pure function module
- Move `tagMap` to useMemo in components that need it
- Move UI state (`editorContent`, `matchedEntries`) to component useState
- Update all imports from store to new locations
- Remove useLorebookStore
- Verify LorebookFilterService & LorebookImportExportService unchanged

---

### Phase 3: Chapter Content Utilities

**Current Issues:**

- `useChapterContentStore` wraps a single pure function (`extractPlainTextFromLexical`)
- `getChapterPlainText(id)` fetches chapter then extracts text - should be a query
- `getChapterPlainTextByChapterOrder` is broken (logged warning)
- No actual state being managed

**Replacements:**

1. **Plain Text Extraction**
    - Already exists as utility: `extractPlainTextFromLexical` in `src/utils/lexicalUtils.ts`
    - Import directly - no wrapper needed
    - Pure function, stateless

2. **Chapter Plain Text Query**
    - Create `useChapterPlainTextQuery(chapterId)`
    - Uses TanStack Query to fetch chapter, then extracts plain text via `select`
    - Example: `select: (chapter) => extractPlainTextFromLexical(chapter.content)`
    - Caches result, dedupes requests

3. **Remove Broken Method**
    - `getChapterPlainTextByChapterOrder` logs warning and returns empty string
    - Find usages, replace with proper query by ID or fix implementation
    - If unused, delete

**Migration Path:**

- Create `useChapterPlainTextQuery` hook
- Update components to use direct utility import or new query
- Remove useChapterContentStore
- Verify no lingering references

---

### Phase 4: Chapter Summary Utilities

**Current Issues:**

- `useChapterStore` fetches data to compute summaries - should be queries
- Delegates to `useChapterContentStore` for text extraction
- No actual state stored, just utility methods

**Replacements:**

1. **Summary Aggregation Queries**
    - Create `useChapterSummariesQuery(storyId, currentOrder, includeLatest?)`
    - Fetches chapters via TanStack Query
    - Uses `select` to filter, sort, and join summaries
    - Returns aggregated summary string
    - Properly cached and invalidated

2. **All Summaries Query**
    - Create `useAllChapterSummariesQuery(storyId)`
    - Similar pattern: fetch chapters, transform to summary string
    - Could share query key with chapters query, use `select` transform

3. **Single Summary Getter**
    - `getChapterSummary(id)` - just needs chapter's summary field
    - Use existing `useChapterQuery(id)` with `select: (chapter) => chapter.summary || ''`
    - No new query needed

4. **Plain Text Delegation**
    - Remove - handled by Phase 3

**Migration Path:**

- Create summary aggregation queries
- Update prompt parsing and context building to use new queries
- Remove useChapterStore
- Verify PromptParser and ContextBuilder still work

---

### Phase 5: Cleanup & Verification

**Tasks:**

1. **Remove Zustand Dependency**
    - Delete all 4 store files
    - Remove `zustand` from package.json
    - Run `npm install` to clean up

2. **Update Imports**
    - Search for all imports from deleted stores
    - Verify all replaced with new patterns
    - Check for any dynamic imports or string-based requires

3. **Test Coverage**
    - AI settings loading and updates
    - Model fetching per provider
    - AI generation streaming
    - Lorebook filtering and matching
    - Tag map building
    - Chapter summary aggregation
    - Lexical text extraction
    - Import/export operations

4. **Performance Validation**
    - Verify TanStack Query caching reduces redundant fetches
    - Check no excessive re-renders from derived state
    - Confirm useMemo used for expensive computations
    - Validate React DevTools Profiler shows improvements

5. **Architecture Verification**
    - Single source of truth: TanStack Query for server state
    - Component state: useState for local UI state
    - Derived state: useMemo or Query's select
    - Operations: Custom hooks or direct service calls
    - Pure utilities: Imported functions, no hooks needed

---

## File Changes Summary

### New Files (TanStack Query Hooks)

- `src/features/ai/hooks/useAISettingsQuery.ts` - Settings query & mutations
- `src/features/ai/hooks/useAvailableModelsQuery.ts` - Model fetching
- `src/features/ai/hooks/useAIGeneration.ts` - Generation operations
- `src/features/chapters/hooks/useChapterPlainTextQuery.ts` - Plain text extraction query
- `src/features/chapters/hooks/useChapterSummariesQuery.ts` - Summary aggregation queries
- `src/features/lorebook/utils/lorebookFilters.ts` - Pure filter functions

### Modified Files (Component Updates)

- All components importing from deleted stores
- Components using AI generation
- Components displaying lorebook matches
- Components building prompts with summaries
- Prompt parser and context builder

### Deleted Files

- `src/features/ai/stores/useAIStore.ts`
- `src/features/lorebook/stores/useLorebookStore.ts`
- `src/features/chapters/stores/useChapterStore.ts`
- `src/features/chapters/stores/useChapterContentStore.ts`

### Dependencies

- Remove `zustand` from package.json

---

## Migration Sequence

Execute phases sequentially:

1. **Phase 1 (AI)** - Most complex, highest risk - do first while fresh
2. **Phase 3 (Chapter Content)** - Simple pure function extraction - quick win
3. **Phase 2 (Lorebook)** - Medium complexity, many component updates
4. **Phase 4 (Chapter Summaries)** - Depends on Phase 3, straightforward queries
5. **Phase 5 (Cleanup)** - Final verification and dependency removal

Within each phase:

- Create new implementations first
- Update components incrementally
- Test each component update
- Delete old store only when all references removed
- Commit after each phase completes

---

## Testing Strategy

### Per Phase

- Unit tests for new utility functions
- Integration tests for new queries/mutations
- Component tests for updated components
- Manual testing of affected features

### Full System

- Story creation and management
- Chapter editing with Lexical
- AI generation (all providers)
- Lorebook matching and filtering
- Prompt parsing and context building
- Import/export operations
- Settings updates
- Model fetching and selection

### Edge Cases

- Offline behavior (TanStack Query's stale-while-revalidate)
- Race conditions in streaming generation
- Cache invalidation timing
- Derived state recalculation efficiency
- Error states and recovery

---

## Rollback Strategy

If migration introduces regressions:

1. **Git branches** - Each phase on separate branch, can revert granularly
2. **Feature flags** - If needed, toggle between old/new implementations
3. **Incremental deployment** - Test each phase in development before merging
4. **Backup verification** - Ensure comprehensive tests before deleting stores

Each phase is independently reversible until store deletion commits.

---

## Post-Migration Benefits

1. **Single source of truth** - TanStack Query manages all server state
2. **Automatic caching** - No manual cache invalidation logic
3. **Optimistic updates** - Built-in via mutations
4. **Stale-while-revalidate** - Better UX, less loading states
5. **Deduplication** - Multiple components querying same data = single request
6. **DevTools** - TanStack Query DevTools for debugging
7. **Less code** - Remove ~500 lines of Zustand store boilerplate
8. **Better patterns** - Clear separation: server state vs. UI state vs. utilities
9. **Easier testing** - Query mocks simpler than store mocks
10. **Performance** - React can optimize pure components, memoization more effective

---

## Notes

- AIService singleton must remain functional - it manages OpenAI client instances
- PromptParser and ContextBuilder are key integration points - test thoroughly
- Lexical editor plugins may reference stores - check SceneBeatPlugin, LorebookTagPlugin
- Scene beat generation uses AI store - needs careful migration
- Brainstorm chat uses AI store - verify streaming still works
- Export/import currently work - don't break during migration
