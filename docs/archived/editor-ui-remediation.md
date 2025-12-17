# Editor UI Remediation Plan

## Problems Identified

1. **Maximise button does nothing useful** - Only removes slight padding; sidebars remain fixed
2. **Redundant chapter title** - TopBar (app header) already shows chapter; title bar in editor wastes vertical space
3. **Editor toolbar scrolls off screen** - The formatting toolbar (Normal, Arial, B/I/U, Insert, etc.) uses `sticky top-0` but is sticky relative to its scroll container, not the viewport—so it disappears when scrolling chapter content
4. **Left sidebar doesn't reach top of screen** - Since workspace refactor, sidebar sits below TopBar instead of full height
5. **Sidebar widths too wide** - Left sidebar w-56 (224px) is nearly double what's needed for short labels
6. **Chapter not cleared on story change** - When switching stories, `currentChapterId` isn't reset, so editor shows previous story's chapter

## Current Structure

```
flex-col (min-h-screen)
├── TopBar (full width, h-14) ← SPANS FULL WIDTH
└── flex (remaining height)
    ├── Sidebar (w-56, below TopBar) ← DOESN'T REACH TOP
    └── MainContent
        └── StoryEditor
            ├── Editor Area (max-w-1024, centered)
            │   └── EmbeddedPlayground
            │       ├── Title bar (chapter title + maximise btn) ← REDUNDANT
            │       └── Scrollable container (overflow-auto) ← WRONG SCROLL CONTEXT
            │           └── PlaygroundApp
            │               └── Editor shell
            │                   ├── Editor Toolbar (sticky top-0) ← SCROLLS AWAY
            │                   └── Editor content
            └── Right Sidebar (w-48, fixed) - tool buttons
```

## Solution

### 1. Fix Workspace Layout (sidebar full height)

**Problem:** Sidebar sits below TopBar instead of spanning full viewport height.

**File:** [Workspace.tsx](src/components/workspace/Workspace.tsx)

**Fix:** Restructure layout so sidebar is full-height, TopBar only spans content area:

```
flex (h-screen)
├── Sidebar (full height, left edge)
└── flex-col (remaining width)
    ├── TopBar (spans content area only)
    └── MainContent
```

### 2. Fix Editor Toolbar Scrolling

**Problem:** Editor toolbar has `sticky top-0` but it's sticky relative to its parent scroll container (`overflow-auto` on EmbeddedPlayground wrapper), not the viewport. When you scroll chapter content, the toolbar scrolls away.

**Files:**

- [EmbeddedPlayground.tsx](src/Lexical/lexical-playground/src/EmbeddedPlayground.tsx)
- [Editor.tsx](src/Lexical/lexical-playground/src/Editor.tsx)
- [index.css](src/Lexical/lexical-playground/src/index.css)

**Fix:** Restructure so toolbar is outside the scroll container:

- Remove `overflow-auto` from EmbeddedPlayground's wrapper div
- Make editor area a flex column: toolbar (fixed height) + scrollable content area
- Only the content area scrolls; toolbar stays pinned at top of editor region

### 3. Remove Redundant Title Bar

**Problem:** Chapter title shown in editor duplicates info already in TopBar.

**Files:** [EmbeddedPlayground.tsx](src/Lexical/lexical-playground/src/EmbeddedPlayground.tsx)

**Fix:**

- Remove the title bar div containing chapter title and maximise button
- Move maximise button to editor toolbar (right-hand side)

### 4. Collapsible Sidebars (independent feature)

**Problem:** Sidebars are always expanded; no way to reclaim screen space. Left sidebar is w-56 (224px) which is nearly twice what it needs for short labels like "Stories", "Editor".

**Left Sidebar** [Sidebar.tsx](src/components/workspace/Sidebar.tsx):

- Reduce expanded width from w-56 to ~w-32 (128px) - sufficient for icon + label
- Collapsed width w-12 (48px) for icon-only with tooltips
- Already has collapse toggle; add tooltips when collapsed
- Persist preference to localStorage

**Right Sidebar** [StoryEditor.tsx](src/features/chapters/components/StoryEditor.tsx):

- Reduce from w-48 (192px) to ~w-36 (144px) expanded
- Collapsible to w-12 (48px) icon-only with tooltips
- Add collapse toggle button
- Persist preference to localStorage

**Files:**

- [Sidebar.tsx](src/components/workspace/Sidebar.tsx) - width reduction, tooltips
- [StoryEditor.tsx](src/features/chapters/components/StoryEditor.tsx) - right sidebar collapse logic

### 5. Maximise Mode

**Problem:** Maximise button only removes padding.

**Fix:** Maximise triggers both sidebars to collapse automatically. When un-maximised, sidebars restore to previous state.

- Lift `isMaximized` state to Workspace level (or use context)
- Maximise = force-collapse both sidebars
- Maximise button lives in editor toolbar

**Files:**

- [Workspace.tsx](src/components/workspace/Workspace.tsx) - maximise state
- [StoryEditor.tsx](src/features/chapters/components/StoryEditor.tsx) - respond to maximise

### 6. Fix Chapter Not Cleared on Story Change

**Problem:** When switching stories, `currentChapterId` isn't reset—editor shows previous story's chapter, TopBar chapter selector shows nothing selected.

**File:** [StoryContext.tsx](src/features/stories/context/StoryContext.tsx)

**Fix:** In `setCurrentStoryId`, call `setCurrentChapterId(null)` when story changes:

```typescript
const setCurrentStoryId = (storyId: string | null) => {
    setCurrentStoryIdState(storyId);
    setCurrentChapterId(null); // Clear chapter when story changes
    // ... rest of logic
};
```

### 7. Implementation Order

1. Fix chapter not cleared on story change (quick win)
2. Fix workspace layout (sidebar full height)
3. Fix editor toolbar scroll context
4. Remove redundant title bar
5. Reduce sidebar widths + make collapsible
6. Wire up maximise mode to collapse both sidebars

## Key Files to Modify

| File                                                                                | Changes                                        |
| ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| [StoryContext.tsx](src/features/stories/context/StoryContext.tsx)                   | Clear chapter on story change                  |
| [Workspace.tsx](src/components/workspace/Workspace.tsx)                             | Restructure layout, lift maximise state        |
| [EmbeddedPlayground.tsx](src/Lexical/lexical-playground/src/EmbeddedPlayground.tsx) | Remove title bar, restructure scroll container |
| [StoryEditor.tsx](src/features/chapters/components/StoryEditor.tsx)                 | Right sidebar collapse logic                   |
| [Sidebar.tsx](src/components/workspace/Sidebar.tsx)                                 | Width reduction, tooltips, forceCollapsed prop |
| [Editor.tsx](src/Lexical/lexical-playground/src/Editor.tsx)                         | Adjust scroll container structure              |
| [index.css](src/Lexical/lexical-playground/src/index.css)                           | Adjust toolbar positioning if needed           |
