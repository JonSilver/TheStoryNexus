# Plan #01: Workspace Shell

**Dependencies:** None (foundational)

## Objective

Create the persistent workspace shell. ONE workspace that's always present - no landing page, no boundaries. Stories tool is just another tool in the sidebar.

## Architectural Transformation

### Current State
- Landing page at `/`
- Story list at `/stories`
- Series list at `/series`
- Story dashboard at `/dashboard/:storyId`
- Nested routes for each feature
- Multiple navigation contexts (feel like different "places")

### Target State
- Single persistent workspace
- Root route `/` loads workspace
- Sidebar with 7 tools (Stories, Editor, Chapters, Lorebook, Brainstorm, Prompts, Notes)
- Tool switching via React state, not routing
- No navigation boundaries - always in the same workspace

### Core Architecture

**Component hierarchy:**
```
App
└─ WorkspaceProvider (context)
   └─ Workspace (layout component)
      ├─ TopBar (app title, story name, settings, AI config, guide)
      ├─ Sidebar/BottomToolbar (7 tools, responsive)
      └─ MainContent (renders active tool component)
```

**State structure:**
```typescript
WorkspaceContext {
  currentTool: 'stories' | 'editor' | 'chapters' | 'lorebook' | 'brainstorm' | 'prompts' | 'notes'
  currentStoryId: string | null
  currentChapterId: string | null
  setCurrentTool: (tool) => void
  setCurrentStoryId: (id) => void
  setCurrentChapterId: (id) => void
}
```

**Default state on load:**
- Check localStorage for last story ID
- If found → `currentStoryId` = stored ID, `currentTool` = 'editor'
- If not found → `currentStoryId` = null, `currentTool` = 'stories'

## The 7 Tools

**1. Stories** - Story and series list/management
- Shows when no story selected
- Click story → sets currentStoryId, switches to Editor
- Always accessible to switch stories

**2. Editor** - Write chapter content
- Only enabled when story selected
- If no story: shows "Select a story first" message

**3. Chapters** - Manage chapter list
- Only enabled when story selected

**4. Lorebook** - Manage lorebook entries
- Only enabled when story selected

**5. Brainstorm** - AI chat
- Only enabled when story selected

**6. Prompts** - Manage prompts
- Only enabled when story selected

**7. Notes** - Story notes
- Only enabled when story selected

## Key Technical Decisions

### Routing Decision
**Option A:** No routing - just `/` for everything, all state-based
**Option B:** Optional deep linking with `/story/:storyId` but workspace always present

**Recommendation:** Start with Option A for this plan. Can add B later if needed.

**Implementation:**
- Remove all existing routes (landing, stories, series, dashboard, dashboard children)
- Single root route `/` renders Workspace
- All navigation is tool switching via state

### Sidebar vs Toolbar Pattern

**Desktop (>768px):** Vertical sidebar on left
- Tool list (icon + label)
- Active tool highlighted
- Collapsible button (minimize to icons only)
- Fixed position

**Mobile (<768px):** Bottom toolbar
- Horizontal tool buttons (icon + compact label)
- Active tool highlighted
- Fixed position above keyboard safe area
- May need "More" menu if all 7 don't fit

**Decision point:** Use responsive breakpoint or separate components? Recommend single component with responsive styling.

### Tool Switching Mechanism

**User clicks tool in sidebar:**
1. Check if story required for that tool
2. If required and no story selected → show toast "Select a story first", don't switch
3. If story not required or story selected → `setCurrentTool(tool)`, main content updates

**Special case - Stories tool:**
- Always enabled
- Clicking it when story is selected: Shows story list, keeps currentStoryId (for quick story switching)

### Top Bar Content

**Left side:**
- App title "Story Nexus" or logo
- Current story name (if story selected), clickable → quick story switcher dropdown

**Right side:**
- Settings icon → settings modal
- AI config icon → AI settings modal
- Guide/help icon → user guide (modal or side panel)

**Center (when story selected):**
- Chapter switcher dropdown (placeholder for now, implemented in #03)

### Placeholder Main Content

For this plan, main content just shows:
```
<div>Current tool: {currentTool}</div>
<div>Current story: {currentStoryId || 'None'}</div>
```

Actual tool implementations come in #02-#08.

## Functionality to Preserve

**In this plan:**
- All existing functionality still accessible via old routes (temporarily)
- This plan adds the workspace shell alongside existing app
- Don't remove old routes yet - just add new workspace

**Plan #02 will:**
- Implement Stories tool (migrate stories/series functionality)
- Start removing old routes

## Implementation Steps

1. **Create WorkspaceContext**
   - Context file with state and setters
   - Provider component
   - Custom hook

2. **Create Workspace component**
   - Fetch stories list (for story switcher)
   - Load last story from localStorage if exists
   - Initialize context state
   - Render layout (TopBar + Sidebar + MainContent)

3. **Create Sidebar component**
   - 7 tool buttons
   - Active state styling
   - Disabled state for tools requiring story
   - Collapsible functionality (desktop)
   - Responsive → toolbar on mobile

4. **Create TopBar component**
   - App title
   - Story name display (if story selected)
   - Story switcher dropdown (if stories exist)
   - Settings, AI config, guide icons
   - Chapter switcher placeholder

5. **Create MainContent component**
   - Switch statement on currentTool
   - For now, all tools show placeholder
   - Loading states

6. **Update App.tsx routing**
   - Add `/` route → Workspace
   - Keep existing routes for now (cleanup in #02)

7. **localStorage integration**
   - Save currentStoryId on change
   - Load on workspace mount
   - Save currentTool (optional)

## Testing Criteria

### Functional
- [ ] Navigate to `/` loads workspace
- [ ] Workspace shows with sidebar and top bar
- [ ] All 7 tools listed in sidebar
- [ ] Clicking tool updates active state
- [ ] Tools requiring story are disabled when no story selected
- [ ] Stories tool always enabled
- [ ] Main content shows current tool name (placeholder)
- [ ] If previous story in localStorage, loads with that story selected
- [ ] If no previous story, shows Stories tool active
- [ ] Top bar shows story name when story selected
- [ ] Top bar story dropdown lists all stories
- [ ] Clicking story in dropdown updates currentStoryId
- [ ] Mobile breakpoint shows bottom toolbar instead of sidebar
- [ ] Sidebar collapse works (desktop)
- [ ] Settings, AI config, guide icons accessible

### Technical
- [ ] Zero lint errors
- [ ] Zero build errors
- [ ] No console errors
- [ ] Context updates correctly
- [ ] localStorage saves/loads correctly
- [ ] Existing routes still work (old app untouched)

## Known Limitations

**Resolved in later plans:**
- Stories tool not implemented (just placeholder) → #02
- Editor tool not implemented → #03
- Other tools not implemented → #04-#08
- Chapter switcher not functional → #03
- Old routes still exist → cleanup across #02-#08

## Integration Points

**With existing code:**
- Use existing `useStoriesQuery` for story list
- Use existing `useStoryQuery` for current story data
- Use existing types (Story, Chapter, etc.)
- Don't modify existing pages yet - they stay intact

**Data fetching:**
- Workspace needs stories list for top bar dropdown
- Fetch with TanStack Query, same as existing pages
- Handle loading/error states

## Notes for Implementer

**Do:**
- Keep it minimal - just the shell
- Use existing UI components (Button, DropdownMenu, etc. from shadcn)
- Test responsive behavior thoroughly
- Verify existing app unaffected

**Don't:**
- Remove existing routes or pages
- Implement actual tool content (wait for #02-#08)
- Add complex state management (keep it simple)
- Break existing functionality

**Dependencies to install:**

If using Shadcn sidebar:
```bash
npx shadcn@latest add sidebar
```

For collapsible behavior (if building custom):
```bash
npm install @radix-ui/react-collapsible
```

For command palette (install now, use in #10):
```bash
npm install cmdk
```

## Success Criteria

**After this plan:**
- Workspace shell exists and loads
- 7 tools in sidebar, switching works
- Story selection via top bar dropdown works
- No story selected → correct default state
- Story selected → correct loaded state
- Responsive layout works
- Zero regressions in existing app
- Foundation ready for tool implementations
