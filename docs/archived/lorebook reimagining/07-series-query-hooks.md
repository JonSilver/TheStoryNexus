# Task 07: Series TanStack Query Hooks

## Objective

Create TanStack Query hooks for series data fetching, mutations, and cache management.

## Context

- Follow existing patterns from `useStoriesQuery.ts` and `useChaptersQuery.ts`
- Implement query keys, queries, mutations with cache invalidation
- Enable optimistic updates for better UX

## Dependencies

- **Task 02**: Updated types
- **Task 06**: API client with series methods

## File Locations

- **Create**: `src/features/series/hooks/useSeriesQuery.ts`

## Implementation Steps

### 1. Create Series Query Hook File

Create `src/features/series/hooks/useSeriesQuery.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { seriesApi } from "@/services/api/client";
import type { Series } from "@/types/entities";

// Query keys factory
export const seriesKeys = {
    all: ["series"] as const,
    lists: () => [...seriesKeys.all, "list"] as const,
    list: () => [...seriesKeys.lists()] as const,
    details: () => [...seriesKeys.all, "detail"] as const,
    detail: (id: string) => [...seriesKeys.details(), id] as const,
    stories: (id: string) => [...seriesKeys.detail(id), "stories"] as const,
    lorebook: (id: string) => [...seriesKeys.detail(id), "lorebook"] as const
};

// Query: List all series
export const useSeriesQuery = () => {
    return useQuery({
        queryKey: seriesKeys.list(),
        queryFn: seriesApi.getAll
    });
};

// Query: Single series by ID
export const useSingleSeriesQuery = (id: string | undefined) => {
    return useQuery({
        queryKey: seriesKeys.detail(id!),
        queryFn: () => seriesApi.getById(id!),
        enabled: !!id
    });
};

// Query: Stories in series
export const useSeriesStoriesQuery = (seriesId: string | undefined) => {
    return useQuery({
        queryKey: seriesKeys.stories(seriesId!),
        queryFn: () => seriesApi.getStories(seriesId!),
        enabled: !!seriesId
    });
};

// Query: Series lorebook entries
export const useSeriesLorebookQuery = (seriesId: string | undefined) => {
    return useQuery({
        queryKey: seriesKeys.lorebook(seriesId!),
        queryFn: () => seriesApi.getLorebook(seriesId!),
        enabled: !!seriesId
    });
};

// Mutation: Create series
export const useCreateSeriesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: seriesApi.create,
        onSuccess: () => {
            // Invalidate series list
            queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
        }
    });
};

// Mutation: Update series
export const useUpdateSeriesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Series, "id" | "createdAt">> }) =>
            seriesApi.update(id, data),
        onSuccess: (_, variables) => {
            // Invalidate specific series and list
            queryClient.invalidateQueries({ queryKey: seriesKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
        }
    });
};

// Mutation: Delete series
export const useDeleteSeriesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: seriesApi.delete,
        onSuccess: () => {
            // Invalidate series list and stories list (orphaned stories update)
            queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
            queryClient.invalidateQueries({ queryKey: ["stories"] });
        }
    });
};
```

### 2. Add Optimistic Updates (Optional Enhancement)

For better UX, add optimistic updates to mutations:

```typescript
export const useUpdateSeriesMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Series> }) => seriesApi.update(id, data),
        onMutate: async ({ id, data }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: seriesKeys.detail(id) });

            // Snapshot previous value
            const previousSeries = queryClient.getQueryData<Series>(seriesKeys.detail(id));

            // Optimistically update
            if (previousSeries) {
                queryClient.setQueryData<Series>(seriesKeys.detail(id), {
                    ...previousSeries,
                    ...data
                });
            }

            return { previousSeries };
        },
        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousSeries) {
                queryClient.setQueryData(seriesKeys.detail(variables.id), context.previousSeries);
            }
        },
        onSettled: (_, __, variables) => {
            queryClient.invalidateQueries({ queryKey: seriesKeys.detail(variables.id) });
        }
    });
};
```

### 3. Export from Feature Index (Optional)

Create `src/features/series/hooks/index.ts`:

```typescript
export * from "./useSeriesQuery";
```

## Hook Summary

After implementation:

**Queries:**

- `useSeriesQuery()` - List all series
- `useSingleSeriesQuery(id)` - Get single series
- `useSeriesStoriesQuery(seriesId)` - Stories in series
- `useSeriesLorebookQuery(seriesId)` - Series lorebook entries

**Mutations:**

- `useCreateSeriesMutation()` - Create series
- `useUpdateSeriesMutation()` - Update series
- `useDeleteSeriesMutation()` - Delete series

**Query keys:**

- `seriesKeys.*` - Hierarchical query key factory

## Validation

- Hooks return correctly typed data
- Mutations trigger appropriate cache invalidations
- Query keys are unique and hierarchical
- Disabled queries don't fire when ID undefined
- Test create → list updates automatically
- Test update → detail refreshes
- Test delete → list and stories list refresh

## Notes

- Query keys follow TanStack Query best practices (hierarchical structure)
- Mutations invalidate related queries to keep UI synchronized
- Optimistic updates optional but improve perceived performance
- Follow existing patterns from stories/chapters hooks for consistency
