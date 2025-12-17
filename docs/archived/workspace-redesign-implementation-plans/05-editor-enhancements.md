# Plan #05: Editor Enhancements & Right Panel

**Dependencies:** #03 (Editor tool must exist), #04 (Lorebook tool for matched entries)

## Objective

Add contextual right panel to Editor tool with matched lorebook entries, chapter outline, POV settings, and chapter notes. Desktop only (space constraints on mobile - use drawers/modals instead).

## Right Panel Architecture

### Panel Structure

**Desktop (>1024px):**

```
[Sidebar] [Editor] [Right Panel]
```

Right panel width: ~300-400px
Resizable with react-resizable-panels
Collapsible (toggle button in editor toolbar)
Default state: collapsed (more writing space)

**Mobile (<1024px):**

- No persistent right panel
- Use drawers or modals for same functionality
- Access via FAB or editor toolbar buttons

### Panel Content Sections

**Four contextual views:**

1. **Matched Tags** - Lorebook entries matched in current chapter
2. **Outline** - Chapter outline (if exists)
3. **POV Settings** - Point of view configuration for chapter
4. **Chapter Notes** - Notes specific to this chapter

**UI pattern:**

- Tabbed interface (4 tabs at top of panel)
- Or: Expandable sections (all visible, scroll)
- Or: Single view with dropdown selector

**Recommendation:** Tabs for clear separation

## Matched Tags View

### Purpose

Show lorebook entries that are matched/relevant to current chapter content.

### Functionality

- [ ] List matched entries (character, location, item, event, etc.)
- [ ] Entry preview (title + snippet)
- [ ] Click entry → expanded view (full content in panel)
- [ ] "View in Lorebook" button → switches to Lorebook tool with entry selected
- [ ] Real-time updates as chapter content changes
- [ ] Show match count
- [ ] Filter by category

### Data Source

- LorebookFilterService (existing) for matching
- Query chapter content from editor state
- Query lorebook entries for current story
- Match keywords/tags in chapter against entry tags

### Integration Points

- Read chapter content from Lexical editor state
- Use existing `useLorebookQuery(storyId)`
- Use existing LorebookFilterService.matchEntries()

## Chapter Outline View

### Purpose

Display and edit chapter outline (if user has created one).

### Functionality

- [ ] Display outline text (markdown or plain text)
- [ ] Edit outline inline
- [ ] Save outline (auto-save or explicit button)
- [ ] Empty state: "Add an outline for this chapter"
- [ ] Collapsible sections (if outline has structure)

### Data Source

- Chapter.outline field (exists in schema)
- `useChapterQuery(chapterId)` for current chapter data
- `useUpdateChapter` mutation to save

## POV Settings View

### Purpose

Configure point of view for chapter (first person, third person, character, etc.).

### Functionality

- [ ] POV type selector (first person, third person limited, third person omniscient, second person)
- [ ] Character selector (if applicable - which character's POV)
- [ ] Save settings
- [ ] Display in chapter metadata

### Data Source

- Chapter.pov field (check schema - may need to verify structure)
- `useChapterQuery(chapterId)`
- `useUpdateChapter` mutation

## Chapter Notes View

### Purpose

Quick notes specific to this chapter (different from story notes).

### Functionality

- [ ] Text area for notes
- [ ] Markdown support (optional)
- [ ] Auto-save
- [ ] Empty state: "Add notes for this chapter"

### Data Source

- Chapter.notes field (check schema - may need to add if doesn't exist)
- Or: separate chapter_notes table
- `useChapterQuery`, `useUpdateChapter`

## Mobile Alternative

**Since no space for persistent right panel:**

### Option A: Floating Action Button (FAB)

- FAB in bottom-right of editor
- Tap → menu with 4 options (Matched Tags, Outline, POV, Notes)
- Select → opens full-screen drawer with that view

### Option B: Editor Toolbar Buttons

- 4 buttons in editor toolbar
- Tap → opens full-screen drawer

### Option C: Swipe Gesture

- Right edge swipe → opens drawer with tabbed views
- Swipe left to close

**Recommendation:** Combination of B (toolbar buttons) and C (swipe) for discoverability + efficiency

## Implementation Steps

1. **Desktop: Create Right Panel structure**
    - Use react-resizable-panels for Editor + Right Panel split
    - Panel component with tabs/sections
    - Toggle button in editor toolbar
    - Collapsible state (localStorage persistence)

2. **Implement Matched Tags view**
    - Query lorebook entries
    - Match against chapter content
    - Display list with previews
    - Click to expand
    - "View in Lorebook" action

3. **Implement Outline view**
    - Display chapter.outline
    - Inline editor (textarea or markdown editor)
    - Auto-save on change

4. **Implement POV Settings view**
    - Form with POV type selector
    - Character selector (query characters from lorebook)
    - Save button

5. **Implement Chapter Notes view**
    - Text area
    - Auto-save
    - Optional markdown preview

6. **Mobile: Create drawer alternatives**
    - Drawer component (use shadcn Drawer or Vaul, existing)
    - Same content as panel tabs
    - Trigger buttons in toolbar or FAB

7. **Update EditorTool component**
    - Wrap Lexical editor + right panel in resizable panels
    - Handle panel toggle
    - Pass current chapter data to panel

8. **Test responsive behavior**
    - Desktop: panel shows, resizes, collapses
    - Mobile: drawers work, toolbar buttons accessible

## Technical Considerations

### Performance

**Matched tags:**

- Matching against chapter content can be expensive
- Debounce matching (don't match on every keystroke)
- Or: Match on chapter load and on explicit "refresh" button
- Cache matched entries

**Real-time updates:**

- Editor content changes frequently
- Don't re-match on every change
- Match on: chapter load, manual refresh, periodic interval (30s?)

### Panel State Persistence

**Remember:**

- Panel open/collapsed state
- Panel width (if resizable)
- Active tab

**Store in:** localStorage keyed by user preference (not per-chapter)

### Resizable Panel Implementation

**Use react-resizable-panels:**

```typescript
<PanelGroup direction="horizontal">
  <Panel defaultSize={70} minSize={50}>
    <EditorContent />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={30} minSize={20} maxSize={40} collapsible>
    <RightPanel />
  </Panel>
</PanelGroup>
```

## Testing Criteria

### Desktop

- [ ] Right panel renders when Editor active
- [ ] Panel can be toggled open/closed
- [ ] Panel can be resized (drag handle)
- [ ] Panel state persists across sessions
- [ ] Matched Tags view shows relevant entries
- [ ] Click entry expands in panel
- [ ] "View in Lorebook" switches to Lorebook tool
- [ ] Outline view displays and edits chapter outline
- [ ] Outline saves correctly
- [ ] POV Settings view displays and saves POV config
- [ ] Chapter Notes view displays and saves notes
- [ ] Switching chapters updates panel content
- [ ] Switching away from Editor and back preserves panel state

### Mobile

- [ ] No right panel on mobile
- [ ] Toolbar buttons or FAB accessible
- [ ] Drawers open with same content
- [ ] Drawers close correctly
- [ ] All functionality works in drawer views

### Technical

- [ ] Zero lint errors
- [ ] Zero build errors
- [ ] No console errors
- [ ] Matching performance acceptable
- [ ] Auto-save works for outline and notes
- [ ] Panel doesn't break editor functionality

## Known Limitations

**Resolved in later plans:**

- Keyboard shortcut to toggle panel → #06
- Command palette integration → #06
- Enhanced matched entry actions → #07

## Notes for Implementer

**Do:**

- Test panel resize performance
- Verify lorebook matching logic
- Check chapter schema for outline/POV/notes fields
- Test mobile drawers thoroughly
- Consider UX for empty states

**Don't:**

- Make matching too aggressive (performance)
- Break editor functionality with panel integration
- Forget mobile alternative
- Over-engineer - keep it simple

## Success Criteria

**After this plan:**

- Right panel functional on desktop
- All 4 views implemented and working
- Matched tags accurately show relevant entries
- Outline, POV, notes can be edited and saved
- Mobile drawers provide same functionality
- Panel enhances writing experience without being intrusive
- Zero regressions in editor functionality
- Ready for command palette integration (#06)
