# Task 02: Update TypeScript Types

## Objective

Add Series type and update LorebookEntry and Story types to support hierarchy.

## Context

- TypeScript types must match new database schema from Task 01
- Maintain backward compatibility during Phase 1

## Dependencies

- **Task 01**: Database schema must be updated first

## File Locations

- **Types**: `src/types/entities.ts`
- **Schemas**: `src/schemas/entities.ts` (if Zod validation used)

## Implementation Steps

### 1. Add Series Type

Add to `src/types/entities.ts`:

```typescript
export interface Series extends BaseEntity {
    name: string;
    description?: string;
}
```

### 2. Update LorebookEntry Type

Modify in `src/types/entities.ts`:

```typescript
export interface LorebookEntry extends BaseEntity {
    storyId: string; // Keep temporarily (Phase 1)
    level: "global" | "series" | "story"; // NEW
    scopeId?: string; // NEW - seriesId when level='series', storyId when level='story'
    name: string;
    description: string;
    category: "character" | "location" | "item" | "event" | "note" | "synopsis" | "starting scenario" | "timeline";
    tags: string[];
    metadata?: Record<string, unknown>;
    isDisabled?: boolean;
}
```

### 3. Update Story Type

Add seriesId to `src/types/entities.ts`:

```typescript
export interface Story extends BaseEntity {
    title: string;
    author: string;
    language: string;
    synopsis?: string;
    seriesId?: string; // NEW
}
```

### 4. Add Level Type Alias

Create type alias for reuse:

```typescript
export type LorebookLevel = "global" | "series" | "story";
```

### 5. Update StoryExport Type (if exists)

Add optional series field:

```typescript
export interface StoryExport {
    // ... existing fields
    series?: Series; // NEW - include if story belongs to series
}
```

### 6. Add Validation Helpers (optional)

Create validation function in `src/types/entities.ts` or separate utilities file:

```typescript
export const validateLorebookEntry = (entry: LorebookEntry): boolean => {
    if (entry.level === "global" && entry.scopeId) return false;
    if (entry.level === "series" && !entry.scopeId) return false;
    if (entry.level === "story" && !entry.scopeId) return false;
    return true;
};
```

### 7. Add Zod Schemas (if used)

Update `src/schemas/entities.ts`:

```typescript
import { z } from "zod";

export const seriesSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name required"),
    description: z.string().optional(),
    createdAt: z.date(),
    isDemo: z.boolean().optional()
});

export const lorebookLevelSchema = z.enum(["global", "series", "story"]);

export const lorebookEntrySchema = z
    .object({
        id: z.string(),
        storyId: z.string(), // Keep temporarily
        level: lorebookLevelSchema,
        scopeId: z.string().optional(),
        name: z.string().min(1),
        description: z.string(),
        category: z.enum([
            "character",
            "location",
            "item",
            "event",
            "note",
            "synopsis",
            "starting scenario",
            "timeline"
        ]),
        tags: z.array(z.string()),
        metadata: z.record(z.unknown()).optional(),
        isDisabled: z.boolean().optional(),
        createdAt: z.date(),
        isDemo: z.boolean().optional()
    })
    .refine(
        data => {
            if (data.level === "global") return !data.scopeId;
            return !!data.scopeId;
        },
        { message: "scopeId required for series/story level, forbidden for global level" }
    );

export const storySchema = z.object({
    // ... existing fields
    seriesId: z.string().optional()
});
```

## Validation

- TypeScript compilation succeeds with no errors
- Types match database schema from Task 01
- Validation functions correctly enforce level/scopeId constraints

## Notes

- Keep `storyId` field in LorebookEntry during Phase 1
- Phase 2 (later task) will remove storyId from type definitions
- Validation is optional but recommended for runtime safety
