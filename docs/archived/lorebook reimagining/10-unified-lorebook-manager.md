# Task 10: Unified Lorebook Manager UI

## Objective

Create single unified lorebook management UI with level/scope selector for managing global, series, and story-level entries.

## Context

- Replace three separate lorebook UIs with one unified manager
- User selects context via level dropdown and conditional scope selector
- All lorebook operations happen in one place
- Story lorebook view (Task 11) is just a shortcut to this unified manager

## Dependencies

- **Task 08**: Lorebook query hooks with level-based queries
- **Existing**: Lorebook components in `src/features/lorebook/components/`

## File Locations

- **Modify**: `src/features/lorebook/pages/LorebookPage.tsx`
- **Create**: `src/features/lorebook/components/LevelScopeSelector.tsx`
- **Create**: `src/features/lorebook/components/LevelBadge.tsx`
- **Modify**: `src/features/lorebook/components/LorebookEntryForm.tsx`
- **Modify**: `src/features/lorebook/components/LorebookEntryCard.tsx`

## Implementation Steps

### 1. Create LevelBadge Component

Visual indicator for entry level:

```typescript
// src/features/lorebook/components/LevelBadge.tsx
import { Badge } from '@/components/ui/badge';
import type { LorebookLevel } from '@/types/entities';

interface LevelBadgeProps {
    level: LorebookLevel;
}

const LEVEL_STYLES = {
    global: 'bg-blue-500 hover:bg-blue-600',
    series: 'bg-purple-500 hover:bg-purple-600',
    story: 'bg-green-500 hover:bg-green-600',
} as const;

const LEVEL_LABELS = {
    global: 'Global',
    series: 'Series',
    story: 'Story',
} as const;

export const LevelBadge = ({ level }: LevelBadgeProps) => {
    return (
        <Badge variant="secondary" className={LEVEL_STYLES[level]}>
            {LEVEL_LABELS[level]}
        </Badge>
    );
};
```

### 2. Create LevelScopeSelector Component

Combined level and scope selection UI:

```typescript
// src/features/lorebook/components/LevelScopeSelector.tsx
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useSeriesQuery } from '@/features/series/hooks/useSeriesQuery';
import { useStoriesQuery } from '@/features/stories/hooks/useStoriesQuery';
import type { LorebookLevel } from '@/types/entities';

interface LevelScopeSelectorProps {
    level: LorebookLevel;
    onLevelChange: (level: LorebookLevel) => void;
    scopeId?: string;
    onScopeIdChange: (scopeId: string | undefined) => void;
}

export const LevelScopeSelector = ({
    level,
    onLevelChange,
    scopeId,
    onScopeIdChange,
}: LevelScopeSelectorProps) => {
    const { data: seriesList } = useSeriesQuery();
    const { data: storiesList } = useStoriesQuery();

    return (
        <div className="flex gap-4 items-end">
            <div className="flex-1">
                <Label htmlFor="level">Level</Label>
                <Select value={level} onValueChange={(v) => onLevelChange(v as LorebookLevel)}>
                    <SelectTrigger id="level">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="series">Series</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {level === 'series' && (
                <div className="flex-1">
                    <Label htmlFor="series">Series</Label>
                    <Select value={scopeId || ''} onValueChange={onScopeIdChange}>
                        <SelectTrigger id="series">
                            <SelectValue placeholder="Select series" />
                        </SelectTrigger>
                        <SelectContent>
                            {seriesList?.map((series) => (
                                <SelectItem key={series.id} value={series.id}>
                                    {series.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {level === 'story' && (
                <div className="flex-1">
                    <Label htmlFor="story">Story</Label>
                    <Select value={scopeId || ''} onValueChange={onScopeIdChange}>
                        <SelectTrigger id="story">
                            <SelectValue placeholder="Select story" />
                        </SelectTrigger>
                        <SelectContent>
                            {storiesList?.map((story) => (
                                <SelectItem key={story.id} value={story.id}>
                                    {story.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
};
```

### 3. Update LorebookPage to Unified Manager

Replace existing lorebook page with unified manager:

```typescript
// src/features/lorebook/pages/LorebookPage.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LevelScopeSelector } from '../components/LevelScopeSelector';
import { LorebookEntryCard } from '../components/LorebookEntryCard';
import { LorebookEntryDialog } from '../components/LorebookEntryDialog';
import {
    useGlobalLorebookQuery,
    useSeriesLorebookQuery,
    useStoryLorebookQuery,
    useHierarchicalLorebookQuery,
} from '../hooks/useLorebookQuery';
import type { LorebookLevel, LorebookCategory } from '@/types/entities';

const CATEGORIES: LorebookCategory[] = [
    'character',
    'location',
    'item',
    'event',
    'note',
    'synopsis',
    'starting scenario',
    'timeline',
];

export const LorebookPage = () => {
    // Check if coming from story route (shortcut)
    const { storyId } = useParams<{ storyId?: string }>();

    // State for level/scope selection
    const [level, setLevel] = useState<LorebookLevel>(storyId ? 'story' : 'global');
    const [scopeId, setScopeId] = useState<string | undefined>(storyId);
    const [selectedCategory, setSelectedCategory] = useState<LorebookCategory>('character');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // When story route changes, update state
    useEffect(() => {
        if (storyId) {
            setLevel('story');
            setScopeId(storyId);
        }
    }, [storyId]);

    // Fetch appropriate entries based on level/scope
    const { data: globalEntries } = useGlobalLorebookQuery({
        enabled: level === 'global',
    });
    const { data: seriesEntries } = useSeriesLorebookQuery(scopeId, {
        enabled: level === 'series' && !!scopeId,
    });
    const { data: storyEntries } = useStoryLorebookQuery(scopeId, {
        enabled: level === 'story' && !!scopeId && !storyId, // Use non-hierarchical for editing
    });
    const { data: hierarchicalEntries } = useHierarchicalLorebookQuery(scopeId, {
        enabled: level === 'story' && !!scopeId && !!storyId, // Use hierarchical for story shortcut
    });

    // Determine which entries to display
    let entries: LorebookEntry[] = [];
    if (level === 'global') entries = globalEntries || [];
    if (level === 'series') entries = seriesEntries || [];
    if (level === 'story' && storyId) entries = hierarchicalEntries || [];
    if (level === 'story' && !storyId) entries = storyEntries || [];

    // Filter by category
    const entriesByCategory = entries.filter((e) => e.category === selectedCategory);

    // Handler for level change
    const handleLevelChange = (newLevel: LorebookLevel) => {
        setLevel(newLevel);
        setScopeId(undefined); // Reset scope when level changes
    };

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">
                    {storyId ? 'Story Lorebook' : 'Lorebook Manager'}
                </h1>
                <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    disabled={level !== 'global' && !scopeId}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Entry
                </Button>
            </div>

            {/* Level/Scope Selector */}
            {!storyId && (
                <div className="mb-6 p-4 bg-muted rounded-lg">
                    <LevelScopeSelector
                        level={level}
                        onLevelChange={handleLevelChange}
                        scopeId={scopeId}
                        onScopeIdChange={setScopeId}
                    />
                </div>
            )}

            {/* Show info message if scope not selected */}
            {level !== 'global' && !scopeId && (
                <div className="text-center text-muted-foreground py-12">
                    Please select a {level} to view its lorebook entries
                </div>
            )}

            {/* Category tabs and entry list */}
            {(level === 'global' || scopeId) && (
                <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as LorebookCategory)}>
                    <TabsList className="mb-6">
                        {CATEGORIES.map((cat) => (
                            <TabsTrigger key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {CATEGORIES.map((cat) => (
                        <TabsContent key={cat} value={cat}>
                            {entriesByCategory.length > 0 ? (
                                <div className="space-y-2">
                                    {entriesByCategory.map((entry) => {
                                        // In story shortcut, determine if entry is editable
                                        const isEditable = storyId
                                            ? entry.level === 'story' && entry.scopeId === storyId
                                            : true;

                                        return (
                                            <LorebookEntryCard
                                                key={entry.id}
                                                entry={entry}
                                                editable={isEditable}
                                                showLevel={!!storyId} // Show badges in story shortcut
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-12">
                                    No {cat} entries yet
                                </div>
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* Create dialog */}
            <LorebookEntryDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                level={level}
                scopeId={scopeId}
                defaultCategory={selectedCategory}
            />
        </div>
    );
};
```

### 4. Update LorebookEntryCard for Read-Only Support

```typescript
// In src/features/lorebook/components/LorebookEntryCard.tsx

interface LorebookEntryCardProps {
    entry: LorebookEntry;
    editable?: boolean;  // NEW
    showLevel?: boolean;  // NEW
}

export const LorebookEntryCard = ({
    entry,
    editable = true,
    showLevel = false,
}: LorebookEntryCardProps) => {
    // ... existing card implementation

    return (
        <Card className={editable ? '' : 'opacity-75'}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                            {showLevel && <LevelBadge level={entry.level} />}
                            {entry.name}
                        </CardTitle>
                        <CardDescription>{entry.description}</CardDescription>
                    </div>
                    {editable && (
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={handleEdit}>
                                <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleDelete}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
        </Card>
    );
};
```

### 5. Update LorebookEntryDialog

Ensure dialog passes level/scopeId to form:

```typescript
// In src/features/lorebook/components/LorebookEntryDialog.tsx

interface LorebookEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry?: LorebookEntry;
    level: LorebookLevel;
    scopeId?: string;
    defaultCategory?: LorebookCategory;
}

export const LorebookEntryDialog = ({
    open,
    onOpenChange,
    entry,
    level,
    scopeId,
    defaultCategory,
}: LorebookEntryDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {entry ? 'Edit' : 'Create'} Lorebook Entry
                    </DialogTitle>
                </DialogHeader>
                <LorebookEntryForm
                    entry={entry}
                    level={level}
                    scopeId={scopeId}
                    defaultCategory={defaultCategory}
                    onSuccess={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
};
```

### 6. Update Routes

```typescript
// Main lorebook manager
{
    path: '/lorebook',
    element: <LorebookPage />,
}

// Story shortcut (same component, pre-filtered)
{
    path: '/dashboard/:storyId/lorebook',
    element: <LorebookPage />,
}
```

## Component Summary

After implementation:

**Modified Pages:**

- `LorebookPage` - Unified manager with level/scope selector

**New Components:**

- `LevelScopeSelector` - Combined level and scope dropdown UI
- `LevelBadge` - Visual level indicator

**Modified Components:**

- `LorebookEntryCard` - Supports read-only mode and level badge
- `LorebookEntryDialog` - Accepts level/scopeId props

**Routes:**

- `/lorebook` - Main unified lorebook manager
- `/dashboard/:storyId/lorebook` - Story shortcut (same UI, pre-filtered)

## Behavior Summary

### Main Manager (`/lorebook`)

1. User selects level (Global/Series/Story)
2. If Series/Story, conditional dropdown appears
3. Entries filtered by selected level/scope
4. All entries editable in their own context
5. Create button respects selected context

### Story Shortcut (`/dashboard/:storyId/lorebook`)

1. Pre-selects story from route
2. Shows hierarchical entries (global + series + story)
3. Entries display level badges
4. Only story-level entries editable
5. Inherited entries show as read-only

## Validation

- Level selector shows Global/Series/Story options
- Selecting Series shows series dropdown
- Selecting Story shows story dropdown
- Entries filtered correctly by level/scope
- Create button disabled when scope not selected
- Story shortcut pre-selects story and shows inherited entries
- Level badges display correct colors
- Edit buttons only on editable entries in story shortcut
- Category tabs work correctly
- All existing lorebook features still work

## Notes

- Single codebase for all lorebook management
- Story shortcut uses same component with route-based context
- Hierarchical query only used in story shortcut view
- Main manager uses level-specific queries for editing
- All category-specific forms require NO changes
- Reuses 100% of existing entry card/form components
