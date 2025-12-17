# Task 06: API Client Updates

## Objective

Add series API methods and extend lorebook API with level-based queries to frontend API client.

## Context

- API client provides typed methods for all backend endpoints
- Follow existing patterns from `storiesApi`, `chaptersApi`, etc.
- Enable type-safe API calls from React components

## Dependencies

- **Task 02**: Updated TypeScript types
- **Task 03**: Series backend routes
- **Task 04**: Lorebook level-based routes

## File Locations

- **Modify**: `src/services/api/client.ts`

## Implementation Steps

### 1. Add Series API Methods

Add to `src/services/api/client.ts`:

```typescript
import type { Series } from "@/types/entities";

export const seriesApi = {
    async getAll(): Promise<Series[]> {
        const res = await fetch(`${API_BASE_URL}/series`);
        if (!res.ok) throw new Error("Failed to fetch series");
        return res.json();
    },

    async getById(id: string): Promise<Series> {
        const res = await fetch(`${API_BASE_URL}/series/${id}`);
        if (!res.ok) throw new Error("Failed to fetch series");
        return res.json();
    },

    async getStories(seriesId: string): Promise<Story[]> {
        const res = await fetch(`${API_BASE_URL}/series/${seriesId}/stories`);
        if (!res.ok) throw new Error("Failed to fetch series stories");
        return res.json();
    },

    async getLorebook(seriesId: string): Promise<LorebookEntry[]> {
        const res = await fetch(`${API_BASE_URL}/series/${seriesId}/lorebook`);
        if (!res.ok) throw new Error("Failed to fetch series lorebook");
        return res.json();
    },

    async create(data: Omit<Series, "id" | "createdAt">): Promise<Series> {
        const res = await fetch(`${API_BASE_URL}/series`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("Failed to create series");
        return res.json();
    },

    async update(id: string, data: Partial<Omit<Series, "id" | "createdAt">>): Promise<Series> {
        const res = await fetch(`${API_BASE_URL}/series/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("Failed to update series");
        return res.json();
    },

    async delete(id: string): Promise<void> {
        const res = await fetch(`${API_BASE_URL}/series/${id}`, {
            method: "DELETE"
        });
        if (!res.ok) throw new Error("Failed to delete series");
    }
};
```

### 2. Extend Lorebook API Methods

Add level-based methods to existing `lorebookApi` object:

```typescript
export const lorebookApi = {
    // ... existing methods (getAll, getById, create, update, delete)

    async getGlobal(): Promise<LorebookEntry[]> {
        const res = await fetch(`${API_BASE_URL}/lorebook/global`);
        if (!res.ok) throw new Error("Failed to fetch global lorebook");
        return res.json();
    },

    async getBySeries(seriesId: string): Promise<LorebookEntry[]> {
        const res = await fetch(`${API_BASE_URL}/lorebook/series/${seriesId}`);
        if (!res.ok) throw new Error("Failed to fetch series lorebook");
        return res.json();
    },

    async getByStory(storyId: string): Promise<LorebookEntry[]> {
        const res = await fetch(`${API_BASE_URL}/lorebook/story/${storyId}`);
        if (!res.ok) throw new Error("Failed to fetch story lorebook");
        return res.json();
    },

    async getHierarchical(storyId: string): Promise<LorebookEntry[]> {
        const res = await fetch(`${API_BASE_URL}/lorebook/story/${storyId}/hierarchical`);
        if (!res.ok) throw new Error("Failed to fetch hierarchical lorebook");
        return res.json();
    }
};
```

### 3. Verify API Base URL

Ensure `API_BASE_URL` is correctly configured:

- Development: `http://localhost:3001/api`
- Production: `/api` (relative to served frontend)

### 4. Add Error Types (Optional)

Create typed error responses if backend returns structured errors:

```typescript
interface ApiError {
    error: string;
    details?: unknown;
}

const handleApiError = async (res: Response): Promise<never> => {
    const error: ApiError = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error);
};

// Use in API methods:
if (!res.ok) throw await handleApiError(res);
```

## API Client Summary

After implementation, the following API methods will be available:

**Series:**

- `seriesApi.getAll()`
- `seriesApi.getById(id)`
- `seriesApi.getStories(seriesId)`
- `seriesApi.getLorebook(seriesId)`
- `seriesApi.create(data)`
- `seriesApi.update(id, data)`
- `seriesApi.delete(id)`

**Lorebook (new methods):**

- `lorebookApi.getGlobal()`
- `lorebookApi.getBySeries(seriesId)`
- `lorebookApi.getByStory(storyId)`
- `lorebookApi.getHierarchical(storyId)` - **Used by prompt context**

## Validation

- TypeScript compilation succeeds
- All methods return correctly typed data
- Error handling works for failed requests
- Test CRUD operations via browser console or React components

## Notes

- Follow existing error handling patterns from other API methods
- Ensure consistent response parsing (JSON)
- Phase 1 maintains backward compatibility with existing lorebook queries
