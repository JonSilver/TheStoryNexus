# Task 08: Lorebook Query Hooks - Level-Based Queries

## Objective

Extend existing lorebook query hooks to support global, series, story, and hierarchical queries.

## Context

- Build on existing `useLorebookQuery` hooks
- Add level-based query methods
- Add hierarchical query for prompt context (critical for AI features)

## Dependencies

- **Task 02**: Updated types
- **Task 06**: API client with level-based lorebook methods
- **Existing**: `src/features/lorebook/hooks/useLorebookQuery.ts`

## File Locations

- **Modify**: `src/features/lorebook/hooks/useLorebookQuery.ts`

## Implementation Steps

### 1. Extend Query Keys Factory

Update existing query keys to include level-based queries:

```typescript
// In src/features/lorebook/hooks/useLorebookQuery.ts

export const lorebookKeys = {
    all: ["lorebook"] as const,
    lists: () => [...lorebookKeys.all, "list"] as const,
    list: (storyId?: string) => [...lorebookKeys.lists(), storyId ?? "all"] as const,
    details: () => [...lorebookKeys.all, "detail"] as const,
    detail: (id: string) => [...lorebookKeys.details(), id] as const,

    // NEW: Level-based query keys
    global: () => [...lorebookKeys.all, "global"] as const,
    series: (seriesId: string) => [...lorebookKeys.all, "series", seriesId] as const,
    story: (storyId: string) => [...lorebookKeys.all, "story", storyId] as const,
    hierarchical: (storyId: string) => [...lorebookKeys.all, "hierarchical", storyId] as const
};
```

### 2. Add Global Lorebook Query

```typescript
// Query: Global lorebook entries
export const useGlobalLorebookQuery = () => {
    return useQuery({
        queryKey: lorebookKeys.global(),
        queryFn: lorebookApi.getGlobal
    });
};
```

### 3. Add Series Lorebook Query

```typescript
// Query: Series-level lorebook entries
export const useSeriesLorebookQuery = (seriesId: string | undefined) => {
    return useQuery({
        queryKey: lorebookKeys.series(seriesId!),
        queryFn: () => lorebookApi.getBySeries(seriesId!),
        enabled: !!seriesId
    });
};
```

### 4. Add Story Lorebook Query

```typescript
// Query: Story-level lorebook entries only
export const useStoryLorebookQuery = (storyId: string | undefined) => {
    return useQuery({
        queryKey: lorebookKeys.story(storyId!),
        queryFn: () => lorebookApi.getByStory(storyId!),
        enabled: !!storyId
    });
};
```

### 5. Add Hierarchical Lorebook Query (CRITICAL)

```typescript
// Query: Hierarchical lorebook (global + series + story)
// CRITICAL: This is what prompt context should use
export const useHierarchicalLorebookQuery = (storyId: string | undefined) => {
    return useQuery({
        queryKey: lorebookKeys.hierarchical(storyId!),
        queryFn: () => lorebookApi.getHierarchical(storyId!),
        enabled: !!storyId
    });
};
```

### 6. Update Mutation Cache Invalidation

Extend existing mutations to invalidate level-based queries:

```typescript
// Update existing useCreateLorebookMutation
export const useCreateLorebookMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: lorebookApi.create,
        onSuccess: newEntry => {
            // Invalidate based on entry level
            if (newEntry.level === "global") {
                queryClient.invalidateQueries({ queryKey: lorebookKeys.global() });
            } else if (newEntry.level === "series" && newEntry.scopeId) {
                queryClient.invalidateQueries({ queryKey: lorebookKeys.series(newEntry.scopeId) });
            } else if (newEntry.level === "story" && newEntry.scopeId) {
                queryClient.invalidateQueries({ queryKey: lorebookKeys.story(newEntry.scopeId) });
                queryClient.invalidateQueries({ queryKey: lorebookKeys.hierarchical(newEntry.scopeId) });
            }
            // Also invalidate old list query for backward compatibility
            queryClient.invalidateQueries({ queryKey: lorebookKeys.lists() });
        }
    });
};

// Update existing useUpdateLorebookMutation
export const useUpdateLorebookMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<LorebookEntry> }) => lorebookApi.update(id, data),
        onSuccess: updatedEntry => {
            // Invalidate specific entry
            queryClient.invalidateQueries({ queryKey: lorebookKeys.detail(updatedEntry.id) });

            // Invalidate level-based queries
            if (updatedEntry.level === "global") {
                queryClient.invalidateQueries({ queryKey: lorebookKeys.global() });
            } else if (updatedEntry.level === "series" && updatedEntry.scopeId) {
                queryClient.invalidateQueries({ queryKey: lorebookKeys.series(updatedEntry.scopeId) });
            } else if (updatedEntry.level === "story" && updatedEntry.scopeId) {
                queryClient.invalidateQueries({ queryKey: lorebookKeys.story(updatedEntry.scopeId) });
                queryClient.invalidateQueries({ queryKey: lorebookKeys.hierarchical(updatedEntry.scopeId) });
            }

            queryClient.invalidateQueries({ queryKey: lorebookKeys.lists() });
        }
    });
};

// Update existing useDeleteLorebookMutation similarly
export const useDeleteLorebookMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: lorebookApi.delete,
        onMutate: async id => {
            // Get entry before deletion to know which queries to invalidate
            const entry = queryClient.getQueryData<LorebookEntry>(lorebookKeys.detail(id));
            return { entry };
        },
        onSuccess: (_, __, context) => {
            const entry = context?.entry;

            if (entry) {
                if (entry.level === "global") {
                    queryClient.invalidateQueries({ queryKey: lorebookKeys.global() });
                } else if (entry.level === "series" && entry.scopeId) {
                    queryClient.invalidateQueries({ queryKey: lorebookKeys.series(entry.scopeId) });
                } else if (entry.level === "story" && entry.scopeId) {
                    queryClient.invalidateQueries({ queryKey: lorebookKeys.story(entry.scopeId) });
                    queryClient.invalidateQueries({ queryKey: lorebookKeys.hierarchical(entry.scopeId) });
                }
            }

            queryClient.invalidateQueries({ queryKey: lorebookKeys.lists() });
        }
    });
};
```

### 7. Add Level Change Mutation (Optional Enhancement)

Add helper for promoting/demoting entries between levels:

```typescript
// Mutation: Change entry level (e.g., story → series)
export const useChangeLorebookLevelMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            newLevel,
            newScopeId
        }: {
            id: string;
            newLevel: "global" | "series" | "story";
            newScopeId?: string;
        }) => lorebookApi.update(id, { level: newLevel, scopeId: newScopeId }),
        onSuccess: () => {
            // Invalidate all lorebook queries (level changed, hard to track precisely)
            queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
        }
    });
};
```

## Hook Summary

After implementation:

**New Queries:**

- `useGlobalLorebookQuery()` - Global entries
- `useSeriesLorebookQuery(seriesId)` - Series-level entries
- `useStoryLorebookQuery(storyId)` - Story-level entries only
- `useHierarchicalLorebookQuery(storyId)` - **CRITICAL** - Global + series + story

**Updated Mutations:**

- `useCreateLorebookMutation()` - Invalidates level-specific caches
- `useUpdateLorebookMutation()` - Invalidates level-specific caches
- `useDeleteLorebookMutation()` - Invalidates level-specific caches

**Optional New Mutation:**

- `useChangeLorebookLevelMutation()` - Promote/demote entries

## Validation

- Global query returns only global entries
- Series query returns only entries for that series
- Story query returns only story-level entries
- Hierarchical query returns combined global + series + story
- Mutations properly invalidate all affected caches
- Creating story entry invalidates both story and hierarchical queries
- Level changes invalidate appropriate caches

## Notes

- **Hierarchical query is CRITICAL** - used by prompt parser and AI context
- Mutations must invalidate hierarchical cache when story entries change
- Level change mutation useful for UI features like "Promote to Series"
- Maintain backward compatibility with existing list queries during Phase 1
