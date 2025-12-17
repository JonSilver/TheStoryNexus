# Workspace Redesign - Implementation Overview

## Core Concept

**ONE workspace. That's it.**

Not "enter workspace, exit workspace". Not "landing page then workspace". Not "story picker outside workspace".

The Story Nexus IS the workspace. Opening the app = you're in the workspace. Always.

## Architectural Foundation

### The Workspace (Always Present)

**Persistent chrome:**

- Top bar (app title, settings, AI config)
- Sidebar with 7 tools:
    1. **Stories** - list/manage stories and series
    2. **Editor** - write chapters
    3. **Chapters** - manage chapter list
    4. **Lorebook** - manage entries
    5. **Brainstorm** - AI chat
    6. **Prompts** - manage prompts
    7. **Notes** - story notes
- Main content area (shows active tool)

**State management:**

- `currentTool` - which tool is active
- `currentStoryId` - which story is loaded (null if none)
- `currentChapterId` - which chapter is open (null if none)

**No routing navigation** - tool switching is pure React state

### How It Works

**App loads:**

- If no story selected → Stories tool active, main content shows story list
- If returning with story in local storage → that story loaded, Editor tool active
- Always the same persistent workspace chrome

**User clicks story in Stories tool:**

- Sets `currentStoryId` in context
- Switches to Editor tool automatically
- Loads first chapter
- Workspace chrome never changes

**User switches tools:**

- Sidebar click updates `currentTool` state
- Main content swaps tool component
- Instant, no navigation feel
- Story context preserved

**User wants different story:**

- Clicks Stories tool
- Selects different story
- Switches back to Editor with new story loaded

### Critical: No Functionality Loss

**Current functionality that MUST be preserved:**

- Series management (create, edit, delete, group stories)
- Story creation from series or standalone
- Story editing (title, synopsis, settings)
- All editor features (Lexical, scene beats, plugins)
- All lorebook features (CRUD, categories, tags, matching)
- All brainstorm features (chat, prompts, context)
- All prompt management (import/export, system prompts)
- All notes features
- Chapter management (create, reorder, delete, outline, POV)
- AI settings configuration
- Export/import functionality
- Demo content management
- User guide access

**Where this functionality goes:**

- Series/story CRUD → Stories tool main content area
- Story editing → Stories tool (story details panel)
- AI settings → Top bar quick access + settings modal
- Guide → Top bar link or help menu
- Everything else → respective tool

**No orphaned UI:**

- Every feature must have a clear home in the workspace
- If it's not obvious where something goes, flag it in the plan
- Better to have too many menu items than hidden functionality

## Implementation Sequence

### Phase 1: Foundation (Sequential)

**#01 - Workspace Shell**

- Create persistent workspace layout
- Sidebar with 7 tools (Stories, Editor, Chapters, Lorebook, Brainstorm, Prompts, Notes)
- Top bar (app title, settings, AI config)
- WorkspaceContext (currentTool, currentStoryId, currentChapterId)
- Tool switching mechanism (state-based, not routing)
- Placeholder main content (shows current tool name)

**#02 - Stories Tool**

- Story list view in main content area
- Series grouping/management
- Story creation/editing
- Click story → sets currentStoryId, switches to Editor tool
- All series/story CRUD functionality preserved
- No separate "dashboard" concept

**#03 - Editor Tool**

- Refactor existing editor as workspace tool
- Chapter switching (top bar dropdown)
- Loads when story selected
- State preservation (scroll, cursor position per chapter)
- All existing Lexical functionality preserved

**#04 - Chapters Tool**

- Refactor chapters page as tool
- Chapter list, create, reorder, delete, outline
- Click chapter → switches to Editor with that chapter
- All existing chapter management preserved

### Phase 2: Remaining Tools (Can parallelize)

**#05 - Lorebook Tool**
**#06 - Brainstorm Tool**
**#07 - Prompts Tool**
**#08 - Notes Tool**

Each: Refactor existing page as workspace tool, preserve all functionality

### Phase 3: Enhancements

**#09 - Right Panel System** (Editor contextual tools)
**#10 - Command Palette** (Unified search/navigation)
**#11 - Brainstorm → Lorebook Workflow**
**#12 - Editor Quick Reference**
**#13 - Keyboard Shortcuts**
**#14 - Visual Cohesion**

## Critical Technical Decisions

### 1. Routing Strategy

**Decision:** Minimal or no routing
**Options:**

- A: Just `/` - everything state-based
- B: `/story/:storyId` for deep linking, but workspace chrome always present
  **Recommendation:** Option A for simplicity, add B later if needed

### 2. Story Selection Pattern

**Stories tool active:**

- Main content shows story list with series grouping
- Click story → `setCurrentStoryId(id)`, `setCurrentTool('editor')`
- Quick story switch: Top bar shows current story name, click → dropdown to switch

**No story selected:**

- Stories tool active by default
- Main content prompts to select or create story
- Other tools disabled or show "select story first" state

### 3. State Persistence

**Between sessions:**

- Last story ID → localStorage
- Last tool → localStorage (or default to Editor)
- Last chapter per story → localStorage

**During session:**

- All state in WorkspaceContext
- Editor scroll position per chapter in ref Map
- No URL state (or minimal for deep linking)

### 4. Mobile Layout

**Same architecture, different chrome:**

- Bottom toolbar instead of sidebar
- Same 7 tools, same switching mechanism
- Top bar more compact
- Same state management
- Responsive breakpoint swaps layout

### 5. Existing Page Integration

**Strategy:** Wrap, don't rebuild

- Extract existing page components
- Wrap in tool containers
- Connect to workspace context
- Preserve all functionality
- Add only the minimal glue code needed

## Functionality Preservation Checklist

**Must verify after implementation:**

- [ ] All series operations work (CRUD, grouping)
- [ ] All story operations work (create from series, standalone, edit, delete)
- [ ] All editor features work (Lexical, plugins, scene beats, auto-save)
- [ ] All lorebook features work (CRUD, categories, tags, matching, disabled state)
- [ ] All brainstorm features work (chat, prompts, message actions)
- [ ] All prompt features work (CRUD, import/export, system prompts)
- [ ] All notes features work (CRUD)
- [ ] All chapter features work (CRUD, reorder, outline, POV)
- [ ] AI settings accessible and functional
- [ ] Export/import works for all entities
- [ ] Demo content management works
- [ ] User guide accessible
- [ ] No functionality hidden or removed

## Testing Strategy

### Per-Plan Verification

1. Lint and build (automated)
2. Functionality test for features touched
3. Regression test for existing features
4. Explicit approval before next plan

### Integration Checkpoints

- After #02: Stories tool works, story selection works
- After #04: Core navigation works (Stories → Editor → Chapters → back)
- After #08: All tools accessible and functional
- After #14: Full system test, all functionality verified

## Common Pitfalls to Avoid

1. **Don't create boundaries** - it's one workspace, not multiple contexts
2. **Don't hide functionality** - everything must have a clear UI home
3. **Don't rebuild from scratch** - wrap existing components
4. **Don't add routing complexity** - keep it state-based
5. **Don't break existing features** - preserve everything

## Success Criteria

**After implementation:**

- ONE persistent workspace, always present
- No landing page, no boundaries
- All tools accessible via sidebar
- Story selection is just another tool
- Tool switching instant and seamless
- All existing functionality works
- No orphaned or hidden features
- Mobile layout responsive and usable
- Zero regressions

## What Makes a Good Implementation

**Good:**

- Solves the architectural transformation described
- Preserves all functionality
- Integrates cleanly with existing code
- Makes sensible technical decisions
- Follows project conventions

**Bad:**

- Copies code from plans
- Rebuilds instead of wrapping
- Hides or removes functionality
- Creates navigation boundaries
- Breaks existing features

---

**Ready? Start with #01.**
