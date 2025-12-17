# Task 11: Story Lorebook Routing & Integration

## Objective

Add story lorebook route that acts as shortcut to unified lorebook manager with story pre-selected.

## Context

- Story lorebook view uses the same `LorebookPage` component from Task 10
- Route parameter determines pre-filtering and display mode
- Shows hierarchical entries (global + series + story) in story context
- No separate component needed - just routing integration

## Dependencies

- **Task 10**: Unified lorebook manager must be implemented

## File Locations

- **Modify**: Route configuration (e.g., `src/App.tsx` or routes file)
- **Modify**: Story dashboard navigation (add lorebook link)

## Implementation Steps

### 1. Add Story Lorebook Route

The unified `LorebookPage` component already handles story context via route parameter:

```typescript
// In route configuration
{
    path: '/dashboard/:storyId',
    element: <StoryDashboard />,
    children: [
        {
            path: 'chapters',
            element: <ChapterListPage />,
        },
        {
            path: 'chapters/:chapterId',
            element: <ChapterEditorPage />,
        },
        {
            path: 'lorebook',
            element: <LorebookPage />,  // Same component as /lorebook
        },
        {
            path: 'prompts',
            element: <PromptsPage />,
        },
        {
            path: 'brainstorm',
            element: <BrainstormPage />,
        },
        {
            path: 'notes',
            element: <NotesPage />,
        },
    ],
}
```

### 2. Update Story Dashboard Navigation

Add lorebook tab to story dashboard:

```typescript
// In src/features/stories/pages/StoryDashboard.tsx (or equivalent)

import { useParams, Link, Outlet } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const StoryDashboard = () => {
    const { storyId } = useParams<{ storyId: string }>();

    return (
        <div className="container mx-auto p-6">
            {/* Story header */}
            <h1 className="text-3xl font-bold mb-6">Story Dashboard</h1>

            {/* Navigation tabs */}
            <Tabs defaultValue="chapters" className="mb-6">
                <TabsList>
                    <TabsTrigger value="chapters" asChild>
                        <Link to={`/dashboard/${storyId}/chapters`}>Chapters</Link>
                    </TabsTrigger>
                    <TabsTrigger value="lorebook" asChild>
                        <Link to={`/dashboard/${storyId}/lorebook`}>Lorebook</Link>
                    </TabsTrigger>
                    <TabsTrigger value="prompts" asChild>
                        <Link to={`/dashboard/${storyId}/prompts`}>Prompts</Link>
                    </TabsTrigger>
                    <TabsTrigger value="brainstorm" asChild>
                        <Link to={`/dashboard/${storyId}/brainstorm`}>Brainstorm</Link>
                    </TabsTrigger>
                    <TabsTrigger value="notes" asChild>
                        <Link to={`/dashboard/${storyId}/notes`}>Notes</Link>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Nested routes render here */}
            <Outlet />
        </div>
    );
};
```

### 3. Add Navigation Link in Main App

Ensure main lorebook manager is accessible from app navigation:

```typescript
// In main navigation component (header/sidebar)

<nav>
    <Link to="/stories">Stories</Link>
    <Link to="/series">Series</Link>
    <Link to="/lorebook">Lorebook</Link>  {/* Add this */}
    <Link to="/ai-settings">AI Settings</Link>
    <Link to="/guide">Guide</Link>
</nav>
```

## Behavior Differences

### Main Lorebook Manager (`/lorebook`)

- Shows level/scope selector
- User manually selects context
- All entries editable in their own context
- Used for managing global/series entries
- Used for managing any story's entries

### Story Lorebook Shortcut (`/dashboard/:storyId/lorebook`)

- No level/scope selector shown
- Pre-filtered to specific story
- Shows hierarchical entries (global + series + story)
- Level badges displayed
- Only story-level entries editable
- Inherited entries read-only
- Convenience view for writers working on a story

## Route Summary

After implementation:

- `/lorebook` - Main unified lorebook manager
- `/dashboard/:storyId/lorebook` - Story-specific shortcut view

Both routes render the same `LorebookPage` component with different behavior based on route context.

## Validation

- Story dashboard shows lorebook tab
- Clicking lorebook tab navigates to `/dashboard/:storyId/lorebook`
- Page shows hierarchical entries (global + series + story)
- Level badges displayed on entries
- Story-level entries show edit/delete buttons
- Inherited entries show read-only
- Create button defaults to story level
- Main nav shows link to `/lorebook`
- Main lorebook manager shows level/scope selector

## Notes

- No new components needed - uses unified manager from Task 10
- Route parameter (`storyId`) determines behavior
- Same codebase serves both use cases
- Story writers primarily use story shortcut view
- Power users use main manager for global/series entries
