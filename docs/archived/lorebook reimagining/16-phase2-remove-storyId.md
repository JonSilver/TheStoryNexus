# Task 16: Phase 2 - Remove storyId Field

## Objective

Remove temporary `storyId` field from lorebookEntries table after Phase 1 is stable and verified.

## Context

- **DO NOT START THIS TASK UNTIL PHASE 1 FULLY DEPLOYED AND VERIFIED**
- Phase 1 kept storyId for backward compatibility and safety
- Phase 2 removes storyId completely, relying only on level/scopeId
- Two-phase approach allows rollback and verification

## Dependencies

- **All Phase 1 tasks (01-15) completed and verified**
- All code updated to use level/scopeId instead of storyId
- Production verification period completed (recommended: 2+ weeks)

## File Locations

- **Modify**: `server/db/schema.ts`
- **Generate**: New migration via `npm run db:generate`

## Pre-Migration Verification Checklist

Before starting Phase 2, verify:

- [ ] All lorebook entries have correct level field ('global', 'series', or 'story')
- [ ] All lorebook entries with level='story' have valid scopeId
- [ ] All lorebook entries with level='series' have valid scopeId
- [ ] All lorebook entries with level='global' have null/undefined scopeId
- [ ] No code references entry.storyId anywhere in codebase
- [ ] All queries use level/scopeId, not storyId
- [ ] Prompt parser uses hierarchical queries
- [ ] Import/export uses level/scopeId fields
- [ ] Production system stable for 2+ weeks

## Implementation Steps

### 1. Final Code Audit

Search entire codebase for storyId references:

```bash
# Search for any remaining storyId usage
grep -r "storyId" src/ server/ --include="*.ts" --include="*.tsx"

# Specifically check lorebook-related files
grep -r "entry.storyId" src/ server/
grep -r "lorebookEntries.storyId" server/
```

Remove or update any remaining references to use level/scopeId instead.

### 2. Update Database Schema

Remove storyId field from `server/db/schema.ts`:

```typescript
// BEFORE (Phase 1):
export const lorebookEntries = sqliteTable('lorebookEntries', {
    id: text('id').primaryKey(),
    storyId: text('storyId').notNull(),  // REMOVE THIS
    level: text('level').notNull(),
    scopeId: text('scopeId'),
    // ... rest of fields
}, (table) => ({
    storyIdIdx: index('lorebook_story_id_idx').on(table.storyId),  // REMOVE THIS
    levelIdx: index('lorebook_level_idx').on(table.level),
    scopeIdIdx: index('lorebook_scope_id_idx').on(table.scopeId),
    levelScopeIdx: index('lorebook_level_scope_idx').on(table.level, table.scopeId),
    // ... other indices
}));

// AFTER (Phase 2):
export const lorebookEntries = sqliteTable('lorebookEntries', {
    id: text('id').primaryKey(),
    level: text('level').notNull(),
    scopeId: text('scopeId'),
    name: text('name').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    tags: text('tags', { mode: 'json' }).notNull(),
    metadata: text('metadata', { mode: 'json' }),
    isDisabled: integer('isDisabled', { mode: 'boolean' }),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    isDemo: integer('isDemo', { mode: 'boolean' }),
}, (table) => ({
    levelIdx: index('lorebook_level_idx').on(table.level),
    scopeIdIdx: index('lorebook_scope_id_idx').on(table.scopeId),
    levelScopeIdx: index('lorebook_level_scope_idx').on(table.level, table.scopeId),
    categoryIdx: index('lorebook_category_idx').on(table.category),
    nameIdx: index('lorebook_name_idx').on(table.name),
}));
```

### 3. Generate Migration

```bash
npm run db:generate
```

Drizzle will generate SQLite table recreation SQL (since SQLite doesn't support DROP COLUMN).

**Generated migration will:**

1. Create new table without storyId
2. Copy all data to new table
3. Drop old table
4. Rename new table

Review generated migration carefully before applying.

### 4. Backup Database

**CRITICAL: Backup database before migration**

```bash
# In production environment
cp data/database.db data/database.db.backup-before-phase2
```

### 5. Apply Migration

```bash
npm run db:migrate
```

### 6. Verify Migration

```sql
-- Check schema has no storyId column
PRAGMA table_info(lorebookEntries);

-- Verify all entries still present
SELECT COUNT(*) FROM lorebookEntries;

-- Verify level/scopeId integrity
SELECT level, COUNT(*) FROM lorebookEntries GROUP BY level;

-- Check for any NULL scopeId where it should exist
SELECT * FROM lorebookEntries WHERE level IN ('series', 'story') AND scopeId IS NULL;

-- Check for any scopeId where it shouldn't exist
SELECT * FROM lorebookEntries WHERE level = 'global' AND scopeId IS NOT NULL;
```

### 7. Update TypeScript Types

Remove storyId from `src/types/entities.ts`:

```typescript
// BEFORE (Phase 1):
export interface LorebookEntry extends BaseEntity {
    storyId: string; // REMOVE
    level: "global" | "series" | "story";
    scopeId?: string;
    // ... rest of fields
}

// AFTER (Phase 2):
export interface LorebookEntry extends BaseEntity {
    level: "global" | "series" | "story";
    scopeId?: string; // Required for series/story, undefined for global
    name: string;
    description: string;
    // ... rest of fields
}
```

### 8. Remove Temporary storyId Assignments

Remove any temporary storyId assignments from create/update operations:

```typescript
// BEFORE (Phase 1 - had temporary storyId for backward compat):
await lorebookApi.create({
    ...data,
    level: "story",
    scopeId: storyId,
    storyId: storyId // REMOVE THIS LINE
});

// AFTER (Phase 2):
await lorebookApi.create({
    ...data,
    level: "story",
    scopeId: storyId
});
```

### 9. Update Import/Export (Remove storyId References)

Clean up any temporary storyId handling in import functions:

```typescript
// BEFORE:
await lorebookApi.create({
    ...entry,
    level: "story",
    scopeId: newStoryId,
    storyId: newStoryId // REMOVE
});

// AFTER:
await lorebookApi.create({
    ...entry,
    level: "story",
    scopeId: newStoryId
});
```

### 10. Final Testing

Test all lorebook functionality:

- [ ] Create global lorebook entry
- [ ] Create series lorebook entry
- [ ] Create story lorebook entry
- [ ] Edit entries at each level
- [ ] Delete entries at each level
- [ ] View inherited entries in story lorebook
- [ ] Tag matching in scene beats (hierarchical)
- [ ] Prompt variable resolution with hierarchical entries
- [ ] Export/import story (with lorebook)
- [ ] Export/import series
- [ ] Export/import global lorebook

## Rollback Plan

If issues discovered after Phase 2 migration:

1. **Stop application**
2. **Restore database backup**:
    ```bash
    cp data/database.db.backup-before-phase2 data/database.db
    ```
3. **Revert to Phase 1 code** (git checkout previous commit)
4. **Restart application**
5. **Investigate issues before retrying Phase 2**

## Post-Migration Cleanup

After successful Phase 2 deployment and verification:

1. Remove database backup (or archive):

    ```bash
    # After 1+ month of stable operation
    rm data/database.db.backup-before-phase2
    ```

2. Update documentation to reflect final schema

3. Consider this task complete

## Validation

- Database schema has no storyId column
- No TypeScript compilation errors
- All lorebook features working
- Hierarchical queries working
- Import/export working
- Tag matching working
- No runtime errors referencing storyId

## Notes

- **DO NOT RUSH THIS PHASE** - Wait for Phase 1 stability
- Backup database before migration (critical for rollback)
- Two-phase strategy minimizes risk of data loss
- Phase 2 can be delayed indefinitely if Phase 1 is working
- Consider this a "cleanup" phase, not required for functionality
