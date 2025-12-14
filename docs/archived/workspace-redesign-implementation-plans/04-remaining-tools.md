# Plan #04: Remaining Tools Integration

**Dependencies:** #01 (workspace), #02 (Stories), #03 (Editor)

## Objective

Integrate the remaining 4 tools into workspace: Chapters, Lorebook, Brainstorm, Prompts, Notes. Each follows the same pattern as Editor tool - wrap existing page, preserve all functionality, remove old routes.

## Common Pattern

**For each tool:**
1. Find existing page component
2. Create tool wrapper component
3. Integrate with workspace context (read currentStoryId, currentChapterId if needed)
4. Add to Workspace MainContent switch statement
5. Test all functionality preserved
6. Remove old route

## Chapters Tool

### Current State
- Chapters list at `/dashboard/:storyId/chapters`
- Create, view, reorder, delete chapters
- View chapter outline, POV settings

### Target State
- Chapters tool in workspace
- Click chapter → `setCurrentChapterId`, `setCurrentTool('editor')`
- All chapter management in main content area

### Functionality to Preserve
- [ ] List all chapters for current story
- [ ] Create new chapter
- [ ] Delete chapter (with confirmation)
- [ ] Reorder chapters (drag and drop)
- [ ] View chapter outline
- [ ] Edit chapter title
- [ ] Edit chapter POV settings
- [ ] View word count per chapter
- [ ] View last edited timestamp
- [ ] Export chapter

### Integration Points
- `useChaptersQuery(storyId)` - list chapters
- `useCreateChapter`, `useUpdateChapter`, `useDeleteChapter` mutations
- Drag-and-drop with `@dnd-kit` (existing)

### Chapter Click Behavior
```typescript
const handleChapterClick = (chapterId: string) => {
  setCurrentChapterId(chapterId)
  setCurrentTool('editor')
}
```
Switches to Editor tool with that chapter loaded.

---

## Lorebook Tool

### Current State
- Lorebook at `/dashboard/:storyId/lorebook`
- CRUD for lorebook entries
- Categories, tags, matching, disabled state
- Global/series/story hierarchy

### Target State
- Lorebook tool in workspace
- Split view: categories + entry list + entry editor
- Or: mobile two-stage (list → editor)

### Functionality to Preserve
- [ ] List entries (all or filtered by category)
- [ ] Create entry
- [ ] Edit entry
- [ ] Delete entry
- [ ] Category filtering (character, location, item, event, note, synopsis, starting_scenario, timeline)
- [ ] Tag management
- [ ] Entry matching (auto-match keywords in chapter content)
- [ ] Disabled state toggle
- [ ] Hierarchy (global/series/story)
- [ ] Search/filter entries
- [ ] Entry preview
- [ ] Export/import lorebook

### UI Options
**Desktop:** Three-column split (categories | entry list | entry editor)
**Mobile:** Two-stage (list with category tabs → full-screen entry editor)

### Integration Points
- `useLorebookQuery(storyId)` - fetch entries
- Lorebook mutations (create, update, delete)
- LorebookFilterService (existing) for matching

---

## Brainstorm Tool

### Current State
- Brainstorm chat at `/dashboard/:storyId/brainstorm`
- AI chat for story development
- Message history
- Prompt selection
- Actions: copy message, create lorebook entry from message

### Target State
- Brainstorm tool in workspace
- Full-height chat interface
- All existing functionality preserved

### Functionality to Preserve
- [ ] Chat message history
- [ ] Send message to AI
- [ ] Select prompt for chat
- [ ] Message actions (copy, create lorebook entry)
- [ ] Clear chat
- [ ] Message timestamps
- [ ] Streaming responses
- [ ] Stop generation

### Integration Points
- `useBrainstormQuery(storyId)` - fetch chat messages
- `useSendBrainstormMessage` mutation
- AIService for streaming
- Message action: create lorebook entry (modal)

---

## Prompts Tool

### Current State
- Prompts manager at `/dashboard/:storyId/prompts`
- CRUD for prompts
- System vs user prompts
- Prompt types (scene_beat, gen_summary, etc.)
- Import/export

### Target State
- Prompts tool in workspace
- Split view: prompt list | prompt editor
- System prompts read-only

### Functionality to Preserve
- [ ] List prompts
- [ ] Create prompt
- [ ] Edit prompt
- [ ] Delete prompt (user prompts only)
- [ ] Prompt types (scene_beat, gen_summary, selection_specific, continue_writing, brainstorm, other)
- [ ] Messages array (role, content)
- [ ] Allowed models selection
- [ ] Import prompts (JSON)
- [ ] Export prompts (JSON)
- [ ] System prompt protection (can't edit/delete)

### UI Layout
**Desktop:** Split view (prompt list | prompt editor)
**Mobile:** Two-stage (list → editor)

### Integration Points
- `usePromptsQuery()` - fetch prompts
- Prompt mutations
- Import/export utilities

---

## Notes Tool

### Current State
- Notes at `/dashboard/:storyId/notes`
- Create/edit/delete notes
- Markdown support

### Target State
- Notes tool in workspace
- Split view: note list | note editor

### Functionality to Preserve
- [ ] List notes for current story
- [ ] Create note
- [ ] Edit note (markdown)
- [ ] Delete note
- [ ] Note preview (rendered markdown)
- [ ] Search notes (if exists)

### UI Layout
**Desktop:** Split view (note list | markdown editor)
**Mobile:** Two-stage (list → editor)

### Integration Points
- `useNotesQuery(storyId)` - fetch notes
- Note mutations
- Markdown rendering (react-markdown, existing)

---

## Implementation Sequence

**Recommended order:**
1. Chapters tool (interacts with Editor tool)
2. Lorebook tool (complex UI, used by other tools)
3. Brainstorm tool (standalone, straightforward)
4. Prompts tool (standalone)
5. Notes tool (standalone, simplest)

**Can parallelize** if multiple implementers available.

## Common Implementation Steps (Per Tool)

1. **Locate existing page component**
   - Find in `src/features/[tool]/pages/` or similar
   - Identify main component and sub-components

2. **Create tool wrapper**
   - `src/components/workspace/tools/[Tool]Tool.tsx`
   - Import existing page component
   - Add workspace context integration if needed
   - Pass storyId prop from context

3. **Update Workspace MainContent**
   - Add case for tool in switch statement
   - Render tool component

4. **Test functionality**
   - All CRUD operations work
   - All existing features work
   - No console errors

5. **Remove old route**
   - Delete route from App.tsx
   - Add redirect if necessary

## Common Testing Criteria

**For each tool:**
- [ ] Tool renders in workspace
- [ ] All CRUD operations work
- [ ] All existing features preserved
- [ ] No console errors
- [ ] Zero lint errors
- [ ] Zero build errors
- [ ] Old route removed
- [ ] No broken functionality

## Integration Considerations

### Tool Interdependencies

**Chapters ↔ Editor:**
- Clicking chapter in Chapters tool switches to Editor
- Chapter switcher in top bar (from #03) works from Chapters tool

**Brainstorm → Lorebook:**
- "Create lorebook entry" from message should open modal
- Doesn't switch to Lorebook tool (convenience workflow #11)

**Editor ↔ Lorebook:**
- Matched entries in Editor (right panel #09)
- Quick reference without leaving Editor

### Story Context

All tools need `currentStoryId`:
- Read from workspace context
- Show "Select a story" message if no story selected
- Or disable tool in sidebar if no story (from #01)

### Mobile Layouts

**Split view tools (Lorebook, Prompts, Notes):**
- Desktop: multi-column with resizable panels
- Mobile: two-stage (list → editor with back button)

**Full-screen tools (Editor, Brainstorm):**
- Same on desktop and mobile (full content area)

**Chapters tool:**
- Simple list view on both desktop and mobile

## Notes for Implementer

**Do:**
- Reuse existing components where possible
- Test each tool thoroughly before moving to next
- Check mobile layouts
- Verify all data queries and mutations work
- Test empty states

**Don't:**
- Rebuild components from scratch
- Break existing functionality
- Remove features
- Skip testing
- Rush through these - each tool is important

## Success Criteria

**After this plan:**
- All 7 tools implemented in workspace
- All existing functionality preserved across all tools
- All old routes removed (except AI settings, guide if they're separate)
- Tool switching works for all tools
- Story context correctly provided to all tools
- Mobile layouts work for all tools
- Zero regressions
- Workspace fully functional for core workflow: Stories → Editor/Chapters/Lorebook/Brainstorm/Prompts/Notes
- Ready for enhancement features (#09-#13)
