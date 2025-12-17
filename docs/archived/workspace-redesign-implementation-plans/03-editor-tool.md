# Plan #03: Editor Tool

**Dependencies:** #01 (workspace shell), #02 (Stories tool for story selection)

## Objective

Integrate the Lexical chapter editor as a workspace tool. Implement chapter switching via top bar dropdown. Preserve all editor functionality and Lexical plugins.

## Architectural Changes

### Current State

- Chapter editor at `/dashboard/:storyId/chapters/:chapterId`
- Navigate to editor via URL
- Back button leaves editor
- Chapter switching via separate chapters list page

### Target State

- Editor is a tool in workspace
- Activated when story selected
- Chapter switching via top bar dropdown (instant, no navigation)
- All Lexical functionality preserved
- Editor state (scroll, cursor) preserved per chapter

## Editor Tool Architecture

### Component Structure

```
EditorTool (container)
├─ Chapter switcher (in top bar, not in tool)
├─ Editor toolbar (Lexical toolbar + additional actions)
├─ Lexical Editor component (existing)
│  ├─ LoadChapterContent plugin
│  ├─ SaveChapterContent plugin
│  ├─ SceneBeatNode plugin
│  ├─ LorebookTagPlugin
│  ├─ WordCountPlugin
│  └─ All other existing plugins
└─ Editor state management (scroll position, etc.)
```

### Chapter Switching Mechanism

**Top bar chapter switcher:**

- Dropdown showing all chapters for current story
- Current chapter highlighted
- Click chapter → `setCurrentChapterId(newId)`, editor content updates
- No navigation, no route change
- Instant (chapters cached or fast fetch)

**Chapter switching flow:**

1. User clicks chapter dropdown in top bar
2. Selects different chapter
3. `setCurrentChapterId` called
4. Editor tool detects change, saves current chapter state
5. Loads new chapter content
6. Restores scroll/cursor position for new chapter (if previously visited)

### State Preservation

**Per-chapter state to preserve:**

- Scroll position
- Cursor position (if practical)
- Selection range (if practical)
- Unsaved changes (auto-save handles this)

**Implementation:**

- useRef Map keyed by chapter ID
- On chapter change: save current chapter state, load new chapter state
- Use Lexical's `editor.update()` to restore cursor if possible

**Auto-save:**

- Existing `SaveChapterContent` plugin handles this
- Ensure it continues working after refactor
- Debounced to avoid excessive saves

## Functionality to Preserve

**ALL existing editor functionality must work:**

### Core Editor Features

- [ ] Rich text editing (Lexical)
- [ ] Formatting (bold, italic, underline, etc.)
- [ ] Paragraphs, headings, lists
- [ ] Undo/redo
- [ ] Copy/paste
- [ ] Auto-save (SaveChapterContent plugin)
- [ ] Auto-load (LoadChapterContent plugin)
- [ ] Word count display

### Scene Beats

- [ ] Alt+S / Option+S to insert scene beat
- [ ] Scene beat command input
- [ ] AI generation for scene beats
- [ ] Accept/reject generated content
- [ ] Scene beat context (matched lorebook entries)

### Lorebook Integration

- [ ] @mention autocomplete for lorebook tags
- [ ] Lorebook entry matching in chapter
- [ ] Matched entries display (right panel in #09, or accessible view)

### Editor Toolbar Actions

- [ ] Download chapter
- [ ] View outline (if exists)
- [ ] POV settings (if exists)
- [ ] Chapter notes (if exists)
- [ ] Any other toolbar actions

**Where do these go?**

- Simple actions: Keep in editor toolbar
- Complex panels (outline, POV, notes): Right panel system (#09)

### Chapter Metadata

- Chapter title display/edit
- Chapter number
- Word count
- Last edited timestamp

## Key Technical Decisions

### Chapter Loading Strategy

**Option A:** Fetch chapter data in Editor tool

- Editor tool component fetches via `useChapterQuery(chapterId)`
- Simple, self-contained
- Refetch on chapter change

**Option B:** Prefetch chapters in workspace

- Workspace fetches all chapters for current story
- Cache in TanStack Query
- Editor tool reads from cache
- Faster switching

**Recommendation:** Option A for simplicity, optimize with B later if needed

### Lexical State Management

**Current:** Lexical editor state in `LoadChapterContent` plugin
**Keep it that way** - don't refactor Lexical internals

**Integration point:**

- Editor tool component mounts Lexical Editor
- Passes `chapterId` prop
- LoadChapterContent plugin fetches and loads content
- SaveChapterContent plugin saves on change

**On chapter switch:**

- Unmount old editor? OR
- Update `chapterId` prop, let LoadChapterContent reload?

**Recommendation:** Update prop, let plugin handle reload. Test which works better.

### Top Bar Chapter Switcher Location

**Placement in top bar:**

```
[App Title] [Story Name ▾] [Chapter Name ▾] [Settings] [AI] [Guide]
```

**Shows:** Current chapter name
**On click:** Dropdown of all chapters
**Chapters list:** Title, word count, last edited
**Search:** If many chapters, add search input in dropdown
**Recent chapters:** Show recently edited chapters at top

### Editor Toolbar Integration

**Current:** Editor probably has toolbar with formatting buttons
**Target:** Keep it, but add workspace-specific actions

**Toolbar sections:**

- Formatting (existing Lexical toolbar)
- Content actions (scene beat, download, etc.)
- Context actions (toggle right panel views - #09)

**Don't rebuild toolbar** - augment existing one

## Integration Points

### With Workspace Context

- Read `currentChapterId` from context
- Update on chapter switch
- Read `currentStoryId` for queries

### With Lexical Editor

- Existing `Editor` component at `src/Lexical/lexical-playground/src/Editor.tsx`
- Already accepts props (chapter ID, story ID)
- Verify props, add if missing
- Don't modify Lexical internals unless necessary

### With Existing Plugins

- `LoadChapterContent` - must work with tool integration
- `SaveChapterContent` - must work with tool integration
- `SceneBeatNode` - preserve all functionality
- `LorebookTagPlugin` - preserve autocomplete
- Others - verify all still work

### Data Fetching

- `useChapterQuery(chapterId)` - fetch current chapter
- `useChaptersQuery(storyId)` - fetch chapters list for dropdown
- Use existing hooks, don't create new ones

## Implementation Steps

1. **Verify existing Editor component**
    - Check `src/Lexical/lexical-playground/src/Editor.tsx`
    - Verify it accepts `chapterId` and `storyId` props
    - Verify plugins work correctly

2. **Create EditorTool wrapper component**
    - Container for Lexical Editor
    - Manages chapter state (scroll position, etc.)
    - Passes props to Editor component

3. **Implement chapter state preservation**
    - Create `useEditorState` hook
    - useRef Map for scroll positions keyed by chapter ID
    - Save on chapter change, restore on chapter load

4. **Create chapter switcher for top bar**
    - `ChapterSwitcher` component
    - Dropdown with all chapters
    - Current chapter highlighted
    - Click chapter → `setCurrentChapterId`

5. **Add ChapterSwitcher to TopBar**
    - Show when story and chapter selected
    - Position in center of top bar
    - Responsive (collapse on mobile if needed)

6. **Update Workspace context**
    - Ensure `currentChapterId` state exists (#01 may have added this)
    - Initialize to first chapter when story selected
    - Persist in localStorage

7. **Update Workspace MainContent**
    - `case 'editor':` → render EditorTool
    - Pass storyId and chapterId props
    - Handle loading/error states

8. **Test chapter switching**
    - Switch chapters, verify content updates
    - Verify auto-save works
    - Verify scroll position restored
    - Verify no console errors

9. **Test editor functionality**
    - All formatting works
    - Scene beats work
    - Lorebook integration works
    - Plugins all work
    - Auto-save works

10. **Remove old editor route**
    - Remove `/dashboard/:storyId/chapters/:chapterId` route
    - Redirect to `/` if users have old bookmarks

## Testing Criteria

### Functional

- [ ] Editor tool renders when story selected and Editor tool active
- [ ] Lexical editor loads with chapter content
- [ ] Chapter switcher in top bar shows all chapters
- [ ] Clicking chapter in dropdown switches chapter, updates editor
- [ ] Chapter content saves automatically (debounced)
- [ ] Scroll position preserved per chapter
- [ ] All formatting works (bold, italic, etc.)
- [ ] Scene beats work (Alt+S, generate, accept/reject)
- [ ] Lorebook autocomplete works (@mentions)
- [ ] Word count displays correctly
- [ ] Undo/redo works
- [ ] Toolbar actions work
- [ ] Copy/paste works
- [ ] Switching away from Editor and back preserves state

### Technical

- [ ] Zero lint errors
- [ ] Zero build errors
- [ ] No console errors
- [ ] Lexical plugins all load correctly
- [ ] Chapter query works
- [ ] Chapters query works
- [ ] Auto-save mutation works
- [ ] localStorage persistence works
- [ ] Old editor route removed

## Edge Cases

**No chapters:**

- Show "Create your first chapter" CTA
- Button → creates first chapter, opens in editor

**Chapter deleted while open:**

- Detect via query invalidation
- Switch to first available chapter or show empty state

**Rapid chapter switching:**

- Debounce if necessary
- Ensure auto-save completes before switching

**Long chapter list:**

- Add search to chapter dropdown
- Show recent chapters first
- Paginate if extremely long (unlikely)

## Known Limitations

**Resolved in later plans:**

- Right panel (outline, POV, notes) not implemented → #09
- Chapters tool not integrated → #04
- Other tools not implemented → #04-#08

## Notes for Implementer

**Do:**

- Test thoroughly with existing Lexical editor
- Preserve all plugin functionality
- Verify auto-save works
- Test state preservation
- Check performance on chapter switching

**Don't:**

- Modify Lexical internals unless absolutely necessary
- Break existing plugins
- Rebuild editor from scratch
- Remove functionality

**Critical:**

- The Lexical editor is complex and working - treat it carefully
- If something breaks, investigate before refactoring
- Test with real chapter content, not just "hello world"

## Success Criteria

**After this plan:**

- Editor tool fully functional in workspace
- All Lexical features work
- Chapter switching via top bar dropdown works
- State preservation works
- Zero regressions in editor functionality
- Old editor route removed
- Ready for Chapters tool integration (#04)
