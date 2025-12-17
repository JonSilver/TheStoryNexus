# Codebase Audit & Remediation Plan

## Summary of Issues Found

The codebase has significant deviations from proper React/TanStack Query patterns. Issues fall into four categories:

### 1. CRITICAL: State Management Bypassing TanStack Query

| File                                                   | Issue                                                                                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/ai/hooks/useAIProviderState.ts`          | Complete bypass of TanStack Query. Uses useState/useCallback for all AI provider state (keys, models, defaults). Makes direct aiService calls. Manual isLoading state. |
| `src/features/prompts/hooks/useModelSelection.ts`      | Loads models via useEffect + useState instead of using existing `useAvailableModels` query hook.                                                                       |
| `src/Lexical/.../useSceneBeatData.ts`                  | 8 useState hooks (lines 59-66) for server state. Loads via useEffect. No TanStack Query.                                                                               |
| `src/Lexical/.../useSceneBeatSync.ts`                  | Direct sceneBeatService calls without mutations. No cache invalidation.                                                                                                |
| `src/features/scenebeats/services/sceneBeatService.ts` | Service wrapper with no query hooks - entire SceneBeat subsystem bypasses TanStack Query.                                                                              |
| `src/features/prompts/components/PromptsManager.tsx`   | Direct `promptsApi.getAll()` call (line 43) instead of using query hook.                                                                                               |

### 2. HIGH: Duplicating Server State in Local State

| File                    | Lines       | Issue                                                                                                        |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| `ChapterCard.tsx`       | 70, 189-199 | `summary` useState duplicates `chapter.summary`. Updates both local state AND mutation, causing sync window. |
| `EditStoryDialog.tsx`   | 25-29       | Multiple useState for story fields (title, author, language, synopsis, seriesId) instead of React Hook Form. |
| `CreateStoryDialog.tsx` | 22-26       | Same pattern - 5 useState for form fields instead of React Hook Form.                                        |
| `CreateEntryDialog.tsx` | 70-102      | Complex form with useState + setFormData pattern. Large nested state object.                                 |
| `usePromptFormState.ts` | 12-19       | 8 useState calls for form fields. Should be React Hook Form.                                                 |
| `usePromptSelection.ts` | 18-40       | useState + useEffect to sync from props. Classic antipattern.                                                |

### 3. HIGH: useEffect Antipatterns

| File                    | Lines   | Issue                                                                                |
| ----------------------- | ------- | ------------------------------------------------------------------------------------ |
| `ChapterPOVEditor.tsx`  | 37-39   | useEffect to sync form state when povType changes. Should use onChange handler.      |
| `ChaptersTool.tsx`      | 85-87   | Same pattern - useEffect to reset field.                                             |
| `SettingsPage.tsx`      | 37-39   | useEffect to call initialize(). Should use query with enabled condition.             |
| `usePromptSelection.ts` | 24-40   | useEffect syncs props to state on load. Should be initialiser or useMemo.            |
| `ChatInterface.tsx`     | 116-118 | useEffect calls clearSelections() on mount. Purpose unclear - investigate if needed. |

### 4. MEDIUM: Manual Loading/Error States

| File                        | Lines | Issue                                                     |
| --------------------------- | ----- | --------------------------------------------------------- |
| `ChapterCard.tsx`           | 87    | `isGenerating` manual state instead of mutation.isPending |
| `SettingsPage.tsx`          | 35    | `isDeletingDemo` manual state                             |
| `useAIProviderState.ts`     | 65    | Manual `isLoading`                                        |
| `usePromptPreview.ts`       | 19-21 | Manual `previewLoading`, `previewError`                   |
| `useMessageGeneration.ts`   | 37-40 | Multiple manual streaming states                          |
| `useSceneBeatGeneration.ts` | 32-37 | 6 useState for streaming/preview state - same pattern     |

---

## Remediation Plan

### Phase 1: Create TanStack Query Infrastructure for AI Settings

**Goal**: Replace `useAIProviderState` with proper query/mutation hooks.

**Files to create/modify**:

- `src/features/ai/hooks/useAISettingsQuery.ts` - New query hooks for AI settings
- Delete `src/features/ai/hooks/useAIProviderState.ts`

**Implementation**:

1. Create query keys for AI settings: `["ai", "settings"]`, `["ai", "models", provider]`
2. Create `useAISettingsQuery` - fetches all provider settings
3. Create `useUpdateAPIKeyMutation` - updates API key, invalidates models query
4. Create `useUpdateDefaultModelMutation` - updates default model
5. Create `useRefreshModelsMutation` - forces model refresh
6. Migrate SettingsPage.tsx to use new hooks

### Phase 2: Fix useModelSelection Hook

**Goal**: Use existing TanStack Query hook instead of manual fetch.

**File**: `src/features/prompts/hooks/useModelSelection.ts`

**Implementation**:

1. Replace useState + useEffect with `useAvailableModels()` from `@/features/ai/hooks/useAvailableModels`
2. Keep `selectedModels` and `modelSearch` as local UI state (acceptable)
3. Remove the useEffect that loads models on mount

### Phase 3: Fix Duplicated Server State

#### 3.1 ChapterCard.tsx

**Goal**: Remove duplicated `summary` state.

**Implementation**:

1. Remove `const [summary, setSummary] = useState(chapter.summary || "")`
2. Use controlled input bound to local editing state only when user is actively editing
3. Option A: Use optimistic updates with mutation
4. Option B: Keep temporary edit state but don't duplicate on mount
5. Remove manual `isGenerating` - use streaming state from a custom hook

#### 3.2 Form Components - Convert to React Hook Form

**Goal**: Replace multiple useState with React Hook Form across all form components.

**Files**:

- `EditStoryDialog.tsx` - 5 useState for story fields
- `CreateStoryDialog.tsx` - 5 useState for story fields
- `CreateEntryDialog.tsx` - Complex nested formData state
- `usePromptFormState.ts` - 8 useState (DELETE hook, integrate into PromptForm)

**Implementation**:

1. Add `useForm<FormType>` with defaultValues
2. Replace individual setX calls with form.register or Controller
3. Use form.handleSubmit with mutation
4. For CreateEntryDialog, use nested form fields or flatten structure
5. Delete `usePromptFormState.ts` - move form logic into PromptForm component

#### 3.3 usePromptSelection.ts

**Goal**: Remove useEffect prop sync pattern.

**Implementation**:

1. Derive initial state from props directly in useState initialisers
2. Use a ref to track loaded chatId instead of state
3. Remove the sync useEffect entirely
4. Remove pointless useMemo wrappers (lines 58-59)

### Phase 4: Fix useEffect Antipatterns

#### 4.1 ChapterPOVEditor.tsx & ChaptersTool.tsx

**Goal**: Handle form field sync in onChange, not useEffect.

**Implementation**:

1. In Select onValueChange handler, directly call:
    ```typescript
    if (value === "Third Person Omniscient") {
        form.setValue("povCharacter", undefined);
    }
    ```
2. Remove the useEffect that watches povType

#### 4.2 SettingsPage.tsx

**Goal**: Remove useEffect initialisation call.

**Implementation**:
After Phase 1, SettingsPage will use query hooks that handle loading automatically. The useEffect calling `initialize()` will be deleted.

### Phase 5: Consolidate Streaming State

**Goal**: Create reusable streaming hook.

**File**: Create `src/features/ai/hooks/useStreamingGeneration.ts`

**Implementation**:

1. Encapsulate streaming state (isGenerating, streamingContent, abort)
2. Use this in:
    - `useMessageGeneration.ts` (brainstorm)
    - `useSceneBeatGeneration.ts` (scene beat generation)
    - `ChapterCard.tsx` (summary generation)
3. Consider using useReducer for complex streaming state transitions

### Phase 6: Create TanStack Query Infrastructure for SceneBeats

**Goal**: Bring SceneBeat subsystem into TanStack Query architecture.

**Complexity Warning**: This phase is more complex than others due to Lexical editor integration. The SceneBeat node is a DecoratorNode rendered inside Lexical's editor state. Special care needed for:

- Node creation happens inside `editor.update()` calls
- React strict mode causes double-mount, requiring UNIQUE constraint error handling
- Debounced saves via lodash must coordinate with TanStack mutations
- The node reads its ID from Lexical's internal state, not from React props

**Files to create/modify**:

- `src/features/scenebeats/hooks/useSceneBeatQuery.ts` - CREATE query hooks
- `src/Lexical/.../useSceneBeatData.ts` - Refactor to use query
- `src/Lexical/.../useSceneBeatSync.ts` - Refactor to use mutations
- `src/features/scenebeats/services/sceneBeatService.ts` - DELETE after migration

#### 6.1 Create Query/Mutation Hooks

**File**: `src/features/scenebeats/hooks/useSceneBeatQuery.ts`

```typescript
// Query keys
const sceneBeatKeys = {
  all: ["scenebeats"] as const,
  byId: (id: string) => [...sceneBeatKeys.all, id] as const,
  byChapter: (chapterId: string) => [...sceneBeatKeys.all, "chapter", chapterId] as const
};

// Queries
useSceneBeatQuery(id: string, options?: { enabled?: boolean })
useSceneBeatsByChapterQuery(chapterId: string)

// Mutations
useCreateSceneBeatMutation()  // invalidates byChapter
useUpdateSceneBeatMutation()  // invalidates byId, byChapter
useDeleteSceneBeatMutation()  // invalidates byChapter
```

#### 6.2 Refactor useSceneBeatData

**Current state**: 8 useState hooks + useEffect that:

1. Reads sceneBeatId from Lexical node via `editor.getEditorState().read()`
2. If no ID: creates UUID, sets on node via `editor.update()`, creates DB record
3. If ID exists: loads from DB, handles missing record (creates if needed)
4. Sets all 8 state values from loaded data

**Target state**:

1. Keep sceneBeatId extraction logic (must read from Lexical node)
2. Replace DB load with `useSceneBeatQuery(sceneBeatId, { enabled: !!sceneBeatId })`
3. Replace DB create with `useCreateSceneBeatMutation`
4. Derive initial values from query.data instead of useState
5. **Keep the `editor.update()` calls** - these are Lexical-specific, not React state

**Key insight**: The 8 useState hooks for `initialCommand`, `initialPovType`, etc. should become derived values from `query.data`, not separate state. The `isLoaded` boolean becomes `query.isSuccess`.

#### 6.3 Refactor useSceneBeatSync

**Current state**: Debounced functions calling `sceneBeatService.updateSceneBeat()` directly.

**Target state**:

1. Replace `sceneBeatService.updateSceneBeat()` with `updateMutation.mutate()`
2. **Keep the debounce wrappers** - still needed to avoid excessive DB writes on every keystroke
3. Add `onSuccess` to invalidate relevant query keys

**Pattern**:

```typescript
const updateMutation = useUpdateSceneBeatMutation();

const saveCommand = useMemo(
    () =>
        debounce((command: string) => {
            if (!sceneBeatId) return;
            updateMutation.mutate({ id: sceneBeatId, data: { command } });
        }, 500),
    [sceneBeatId, updateMutation]
);
```

#### 6.4 Handle SceneBeatNode.tsx useEffects

**Current antipatterns in SceneBeatNode.tsx** (lines 106-162):

- `useEffect` to sync toggles from `useSceneBeatData` initial values
- `useEffect` to sync POV from initial values
- `useEffect` to save command changes
- `useEffect` to save toggle changes

**Fix**:

1. Remove sync useEffects (lines 106-112, 119-124) - derive from query.data directly
2. Convert save useEffects (lines 153-162) to call mutations from onChange handlers
3. The `useSceneBeatSync` debounce functions become thin wrappers around mutations

#### 6.5 Delete sceneBeatService.ts

After migration, `sceneBeatService.ts` is a pass-through to `scenebeatsApi`. The mutations will call `scenebeatsApi` directly, making the service redundant.

#### 6.6 Testing Considerations

1. **React Strict Mode**: The current code handles UNIQUE constraint errors from double-create. Ensure mutations handle this gracefully (or use `mutate` idempotently).
2. **Debounce flush on unmount**: Current `flushCommand()` call in `handleDelete` must still work.
3. **Lexical HMR**: The type guard `isSceneBeatNode` handles HMR - don't break this.

### Phase 7: Fix Remaining Manual Loading States

After phases 1-6, review remaining manual loading states:

- `usePromptPreview.ts` - should return loading from its async operation
- Ensure all mutations use `mutation.isPending` not manual state

### Phase 8: Cleanup

1. Run Knip to identify dead code from refactoring
2. Remove unused imports
3. Run lint to catch any issues
4. Test all affected features

---

## Files to Modify (Summary)

| File                                                     | Action                                     |
| -------------------------------------------------------- | ------------------------------------------ |
| `src/features/ai/hooks/useAIProviderState.ts`            | DELETE (replace with query hooks)          |
| `src/features/ai/hooks/useAISettingsQuery.ts`            | CREATE                                     |
| `src/features/ai/hooks/useStreamingGeneration.ts`        | CREATE                                     |
| `src/features/ai/pages/SettingsPage.tsx`                 | Rewrite to use new hooks                   |
| `src/features/prompts/hooks/useModelSelection.ts`        | Refactor to use useAvailableModels         |
| `src/features/chapters/components/ChapterCard.tsx`       | Remove duplicate state, use streaming hook |
| `src/features/stories/components/EditStoryDialog.tsx`    | Convert to React Hook Form                 |
| `src/features/stories/components/CreateStoryDialog.tsx`  | Convert to React Hook Form                 |
| `src/features/lorebook/components/CreateEntryDialog.tsx` | Convert to React Hook Form                 |
| `src/features/prompts/hooks/usePromptFormState.ts`       | DELETE - integrate into PromptForm         |
| `src/features/prompts/components/PromptsManager.tsx`     | Use query hook instead of direct API call  |
| `src/features/chapters/stores/useChapterStore.ts`        | RENAME to `chapterUtils.ts` (not a hook)   |
| `src/features/brainstorm/hooks/usePromptSelection.ts`    | Remove useEffect sync pattern              |
| `src/features/chapters/components/ChapterPOVEditor.tsx`  | Remove useEffect, use onChange             |
| `src/components/workspace/tools/ChaptersTool.tsx`        | Remove useEffect, use onChange             |
| `src/features/brainstorm/hooks/useMessageGeneration.ts`  | Use streaming hook                         |
| `src/features/brainstorm/hooks/usePromptPreview.ts`      | Return proper loading state                |
| `src/features/brainstorm/components/ChatInterface.tsx`   | Review/remove mount useEffect              |
| `src/features/scenebeats/hooks/useSceneBeatQuery.ts`     | CREATE - query/mutation hooks              |
| `src/Lexical/.../useSceneBeatData.ts`                    | Refactor to use query hook                 |
| `src/Lexical/.../useSceneBeatSync.ts`                    | Refactor to use mutations                  |
| `src/Lexical/.../useSceneBeatGeneration.ts`              | Use streaming hook                         |
| `src/features/scenebeats/services/sceneBeatService.ts`   | DELETE if obsolete                         |

---

## Execution Order

1. **Phase 1** - AI settings query hooks (foundation)
2. **Phase 5** - Streaming hook (reusable component)
3. **Phase 6** - SceneBeat query hooks (second major subsystem)
4. **Phases 2-4** - Fix duplicated state and useEffect antipatterns
5. **Phases 7-8** - Manual loading states and cleanup
