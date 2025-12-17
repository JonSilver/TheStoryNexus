# Workspace Design Plan

## Core Concept

The Story Nexus should feel like a **writing studio** where all tools are within easy reach, not a website where you navigate between separate pages. Opening a story enters a persistent workspace where you can fluidly switch between tools without losing context or feeling like you've "gone somewhere else".

---

## Design Metaphor

**Current problem:** Feels like a website - click navigation links, load new pages, lose context, click back buttons.

**Target experience:** Feels like an integrated workspace - tools are always present, switching between them is instant, context is never lost. Think: VS Code, Figma, DAW software - not: documentation website, content management system.

---

## Workspace Principles

1. **Persistent context** - Opening a story enters its workspace; you stay "in" that story until you explicitly exit
2. **Tool switching, not page navigation** - Accessing Lorebook/Brainstorm/etc doesn't feel like leaving where you were
3. **Zero friction chapter switching** - Moving between chapters feels like switching tabs/files, not navigating
4. **Everything within reach** - Common actions accessible without hunting through menus
5. **Context preservation** - Switching tools doesn't lose your place; returning to editor shows exactly where you were
6. **Ergonomic tool placement** - Frequently used tools closer/easier to access than rarely used ones

---

## Story Picker (Outside Workspace)

Before entering a story workspace, users need to select/create stories.

### Story List View

**Purpose:** Story selection, creation, management. This is the only "page navigation" in the app.

**Layout (all devices):**

- Grid of story cards
- Each card shows: title, synopsis snippet, word count, last edited timestamp, cover image (optional)
- Quick action on card: "Continue" → opens story workspace at last-edited chapter
- Series grouping: Optional toggle to group stories by series
- Actions: Create Story, Manage Series, AI Settings, Guide

**No story dashboard.** Clicking story card = enter workspace directly.

**Unconfigured app:**

- First run: Landing screen prompts AI configuration before creating first story
- After AI config: Shows empty story list with prominent "Create Your First Story" CTA
- Demo content toggle: "Load demo story" to explore features

---

## Story Workspace Layout

Once a story is opened, user enters the **Story Workspace** - a persistent environment with all story tools.

### Desktop Layout (> 1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Story: Title] [Chapter: ▾ Current]  [Search] [AI] [Settings]  │ Top Bar
├───┬─────────────────────────────────────────────────────────┬───┤
│   │                                                         │   │
│ T │                 Main Content Area                       │ R │
│ o │                                                         │ i │
│ o │    (Editor / Lorebook / Brainstorm / Prompts / Notes)  │ g │
│ l │                                                         │ h │
│ s │                                                         │ t │
│   │                                                         │   │
│ S │                                                         │ P │
│ i │                                                         │ a │
│ d │                                                         │ n │
│ e │                                                         │ e │
│ b │                                                         │ l │
│ a │                                                         │   │
│ r │                                                         │ O │
│   │                                                         │ p │
│   │                                                         │ t │
│   │                                                         │ i │
│   │                                                         │ o │
│   │                                                         │ n │
│   │                                                         │ a │
│   │                                                         │ l │
└───┴─────────────────────────────────────────────────────────┴───┘
```

**Top Bar (always visible):**

- Story title (click → exit workspace, return to story list)
- Chapter selector dropdown (shows current chapter, click → instant switch to any chapter)
- Search icon → Command palette (Cmd+K)
- AI settings icon → Quick modal for AI config
- Settings/theme toggle

**Tool Sidebar (left, ~200px, collapsible):**

- Tool buttons (vertical stack):
    - **Editor** (default view, shows chapter editor)
    - **Chapters** (manage chapters: create, reorder, delete, view list)
    - **Lorebook** (manage entries: CRUD, search, filter by category)
    - **Brainstorm** (AI chat for story development)
    - **Prompts** (manage prompts: create, edit, import/export)
    - **Notes** (story notes: ideas, research, todos)
- Button states:
    - Active tool highlighted
    - Badge indicators (e.g., unsaved changes, new content)
- Click tool → switches main content area
- Collapse button (bottom): Minimise to icon-only (~48px)

**Main Content Area:**

- Shows currently selected tool's interface
- Full height, full width (minus sidebars)
- Tool-specific UI:
    - **Editor:** Lexical editor with chapter content
    - **Chapters:** List view with chapter cards (create, reorder, manage)
    - **Lorebook:** Category tabs + entry list + entry editor (split view)
    - **Brainstorm:** Chat interface (messages + input)
    - **Prompts:** Prompt list + editor
    - **Notes:** Note list + editor

**Right Panel (optional, ~300-400px, toggleable):**

- Contextual tools when Editor is active:
    - Matched Tags (Lorebook entries matched in current chapter)
    - Chapter Outline
    - POV Settings
    - Chapter Notes
    - Scene Beat suggestions
- Collapsed by default (more writing space)
- Toggle buttons in editor toolbar
- Slides in/out, doesn't navigate

**Key behaviour:**

- Clicking tool sidebar = instant switch, no loading, no "navigation" feel
- Main content area changes, but sidebars stay stable
- Chapter switching (top bar dropdown) = instant, updates editor content
- Right panel independent of tool selection (only visible when Editor active)

---

### Tablet Layout (768px - 1024px)

**Portrait:**

- Similar to mobile (see below)
- Bottom toolbar for tools

**Landscape:**

- Similar to desktop but narrower
- Tool sidebar can collapse to icon-only by default
- Right panel disabled (not enough horizontal space)
- Possible split view: Editor + Lorebook side-by-side (optional enhancement)

---

### Mobile Layout (< 768px)

```
┌─────────────────────────────────┐
│ [< Stories] [Chapter ▾] [⋮]     │ Top Bar
├─────────────────────────────────┤
│                                 │
│                                 │
│       Main Content Area         │
│                                 │
│   (Full-screen tool display)    │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│ [Edit] [Chapters] [Book] [Chat] │ Bottom Toolbar
└─────────────────────────────────┘
```

**Top Bar:**

- Back button: "< Stories" → exit workspace
- Chapter dropdown: Current chapter name, tap → chapter switcher modal
- Menu icon (⋮): Story actions (export, edit story, settings)

**Main Content Area:**

- Full screen for currently selected tool
- No sidebars (space constraints)
- Full-height editor/tool interface

**Bottom Toolbar (always visible, ~60px):**

- 4-5 primary tool buttons (icon + label):
    - **Editor** (pencil icon)
    - **Chapters** (list icon)
    - **Lorebook** (book icon)
    - **Brainstorm** (chat icon)
    - **More** (⋮ icon) → drawer with: Prompts, Notes, AI Settings
- Active tool highlighted
- Tap tool → switches main content instantly

**Contextual Actions:**

- Floating Action Button (FAB, bottom-right):
    - Context-dependent quick actions
    - Editor: Scene beat, Quick Lorebook lookup
    - Chapters: New chapter
    - Lorebook: New entry
    - Brainstorm: Clear chat, New thread

**Edge Swipe Gestures:**

- Left edge swipe → Chapter switcher drawer
- Right edge swipe → Contextual tools drawer (Matched Tags, Outline)
- Never in content areas (prevents spurious navigation during editing)

---

## Tool-Specific Interaction Patterns

### Editor Tool

**Desktop:**

- Full-width Lexical editor
- Toolbar at top: Format, Scene beat (Alt+S), Matched tags, Outline, POV, Notes, Download
- Toolbar buttons toggle right panel or open modal
- Chapter switching via top bar dropdown (instant)
- Command palette (Cmd+K): "Jump to chapter X", "Insert scene beat", "View lorebook entry Y"

**Mobile:**

- Full-screen editor
- Minimal toolbar (format essentials only)
- FAB for quick actions (scene beat, lorebook lookup)
- Chapter switching via top bar dropdown
- Right edge swipe → drawer with: Matched Tags, Outline, POV

**Key behaviour:**

- Typing in editor never triggers navigation
- Selection actions (copy, format) don't interfere with tool switching
- Auto-save (debounced) preserves content continuously

---

### Chapters Tool

**Purpose:** Manage chapter list (create, reorder, delete), view word counts, navigate to specific chapter to edit.

**Desktop:**

- Main content area shows chapter list
- Chapter cards: Title, word count, last edited, outline snippet
- Drag-to-reorder (dnd-kit)
- Click chapter card → switches to Editor tool with that chapter loaded (instant)
- Actions: Create chapter, Delete, Export chapter

**Mobile:**

- Full-screen chapter list
- Tap chapter → switches to Editor tool
- FAB: New chapter

**Key behaviour:**

- This is NOT a separate "page" - it's a tool for managing chapters
- Clicking a chapter doesn't navigate; it switches the Editor tool's context + switches to Editor tool
- Quick return to editing without feeling like you went somewhere else

---

### Lorebook Tool

**Purpose:** Manage Lorebook entries (characters, locations, items, events, notes, synopsis, timelines).

**Desktop:**

- Main content area split:
    - Left (~300px): Category tabs + entry list (filtered by selected category)
    - Right: Entry editor (title, content, tags, category, disabled toggle)
- Click entry in list → loads in editor
- Search/filter bar above entry list
- Create new entry button

**Mobile:**

- Full-screen, two-stage:
    - Stage 1: Entry list with category filter tabs (horizontal scroll)
    - Stage 2 (tap entry): Full-screen entry editor
    - Back button returns to list
- FAB: New entry

**Quick Reference Mode (when Editor is active):**

- Desktop: Right panel shows matched entries (read-only preview)
- Mobile: Right edge swipe → Matched entries drawer
- Click entry → opens Lorebook tool with entry selected

**Key behaviour:**

- Switching to Lorebook tool doesn't lose editor position
- Viewing entry doesn't navigate away from workspace
- Quick reference mode allows checking context without leaving editor

---

### Brainstorm Tool

**Purpose:** AI chat for story development, character brainstorming, plot ideas.

**Desktop:**

- Full-height chat interface in main content area
- Message list (scrollable)
- Input field at bottom
- System prompt selector (dropdown at top)
- Message actions (hover): Copy, Create Lorebook Entry, Create Scene Beat

**Mobile:**

- Full-screen chat interface
- Message actions: Tap message → action menu (Copy, → Lorebook, → Scene Beat)

**Convenience Workflows:**

1. **Brainstorm → Lorebook Entry:**
    - Select text in chat message (or entire message)
    - Action menu: "Create Lorebook Entry"
    - Opens modal: Prefilled with selected text, choose category, add tags, save
    - Entry created in Lorebook (doesn't switch to Lorebook tool)

2. **Brainstorm → Scene Beat:**
    - Tap message action: "Use as Scene Beat"
    - Opens chapter picker modal: Select chapter
    - Switches to Editor tool, chapter loaded, scene beat inserted at cursor

**Key behaviour:**

- Full-screen chat (needs space for conversation)
- Convenience actions don't force tool switching
- Quick capture of ideas into Lorebook without leaving brainstorm flow

---

### Prompts Tool

**Purpose:** Manage prompts (system and user-defined), import/export.

**Desktop:**

- Main content area split:
    - Left: Prompt list (filtered by type)
    - Right: Prompt editor (name, type, messages, allowed models)
- System prompts marked read-only
- Import/Export buttons at top

**Mobile:**

- Two-stage: Prompt list → Prompt editor (full-screen)

**Key behaviour:**

- Infrequent access (setup/configuration)
- Full management interface (not quick reference)

---

### Notes Tool

**Purpose:** Story notes (ideas, research, todos).

**Desktop:**

- Main content area split:
    - Left: Note list
    - Right: Note editor (markdown)

**Mobile:**

- Two-stage: Note list → Note editor

**Quick Capture (Enhancement):**

- Command palette action: "New note" → quick input modal
- Saves without switching to Notes tool

---

## Chapter Switching Mechanisms

Critical requirement: Switching chapters must be **instant and low-friction**.

### Desktop

**Primary Method - Top Bar Dropdown:**

- Current chapter name always visible in top bar
- Click → Dropdown menu with all chapters (scrollable, search-as-you-type if many chapters)
- Click chapter → Instant switch (editor content updates, no "navigation")
- Recent chapters at top (MRU order)

**Secondary Method - Command Palette:**

- Cmd+K → "Jump to chapter..." → Fuzzy search
- Enter → Instant switch

**Tertiary Method - Chapters Tool:**

- Click chapter card in Chapters tool → Switches to Editor with that chapter

### Mobile

**Primary Method - Top Bar Dropdown:**

- Chapter name in top bar, tap → Full-screen chapter picker modal
- List with search, tap chapter → Instant switch

**Secondary Method - Edge Swipe:**

- Left edge swipe → Chapter picker drawer (same as dropdown)

**Tertiary Method - Chapters Tool:**

- Tap chapter in list → Switch to Editor

**Key behaviour:**

- No loading spinners (chapters cached in memory, or fast enough fetch)
- Editor scroll position saved per-chapter (returning to chapter shows where you left off)
- Unsaved changes auto-saved before switching (or prompt if prefer manual save)

---

## Command Palette Integration

**Implementation:** Use `cmdk` library (battle-tested, accessible).

**Trigger:** Cmd+K (desktop), search icon in top bar (mobile).

**Unified search across:**

- Chapters: "Jump to chapter X"
- Lorebook entries: "View entry Y" (opens Lorebook tool with entry selected)
- Prompts: "Edit prompt Z"
- Notes: "Open note A"
- Actions: "Create new chapter", "Export story", "New lorebook entry"

**Behaviour:**

- Fuzzy search with keyboard navigation
- Results grouped by type (Chapters, Lorebook, Actions)
- Selecting result switches to appropriate tool/context (instant)

---

## Convenience Workflows

### Brainstorm → Lorebook Entry

1. User in Brainstorm tool, AI generates character description
2. Tap message → Action menu → "Create Lorebook Entry"
3. Modal opens: Content prefilled, select category (character), add tags, save
4. Entry created in Lorebook (background)
5. Toast notification: "Lorebook entry created"
6. User stays in Brainstorm tool (no context switch)

---

### Editor → Lorebook Quick Reference

1. User writing in Editor
2. Right edge swipe (mobile) or right panel toggle (desktop) → Matched Tags view
3. Shows Lorebook entries matched to current chapter content
4. Tap entry → Expanded view (read-only preview)
5. "View Full Entry" → Switches to Lorebook tool with entry selected
6. Back button/gesture → Returns to Editor (same scroll position)

---

### Scene Beat → Generate Text

1. User in Editor, presses Alt+S (or FAB → Scene Beat)
2. Scene beat node inserted inline
3. User types command (e.g., "Describe the throne room")
4. Click generate → AI uses Lorebook context + chapter context
5. Generated text appears in scene beat node
6. Accept → Text inserted into chapter body, scene beat removed
7. Regenerate → Try again with same or different prompt

---

### Chapter → New Lorebook Entry

1. User writing in Editor, invents new character inline
2. Select character name → Action menu → "Add to Lorebook"
3. Modal: Prefilled with selected text as title, choose category (character), add details/tags
4. Save → Entry created
5. User stays in Editor (no tool switch)

---

### Lorebook Entry → Scene Beat (Indirect)

- Lorebook entries are context, not actions
- User views entry in Lorebook tool, copies relevant detail
- Switches to Editor, inserts scene beat with copied detail as command
- Or: AI generation automatically includes Lorebook context (no manual copying needed)

---

## State Preservation

Critical for workspace feel: Switching tools doesn't lose your place.

### Editor State

- Scroll position per chapter (localStorage or memory)
- Cursor position (restored when returning to chapter)
- Selection state (if practical)
- Unsaved changes auto-saved (debounced)

### Tool State

- Active tool persists in URL/localStorage (returning to story opens last-used tool)
- Lorebook: Last viewed entry, selected category filter
- Brainstorm: Chat history preserved (per story)
- Prompts: Last edited prompt
- Notes: Last viewed note

### Chapter State

- Last edited chapter stored (per story)
- Quick access: "Continue Writing" opens last-edited chapter in Editor

---

## Visual Design Principles

### Cohesion Cues

- Persistent top bar (never disappears)
- Tool sidebar (desktop) or bottom toolbar (mobile) always visible
- No full-page transitions (content area updates, chrome stays stable)
- Instant tool switching (no loading spinners unless genuinely slow operation)

### Tool Differentiation

- Subtle background colour shift per tool (Editor = neutral, Lorebook = warm, Brainstorm = cool)
- Icon + label consistently paired
- Active tool clearly highlighted (bold, underline, border)

### Workspace Boundaries

- Story list = outside workspace (different chrome)
- Story workspace = persistent chrome, tool switching within
- Visual transition when entering/exiting workspace (e.g., slide animation, fade)

---

## Mobile-Specific Considerations

### Tool Switching Feel

- Bottom toolbar tap → Instant content swap (no slide animation, just fade/instant)
- No "back" button between tools (use bottom toolbar to switch freely)
- Back button (top-left) only for exiting workspace to story list

### Full-Screen Tools

- Each tool takes full screen (necessary for usable space)
- But: Toolbar always visible (context awareness)
- Quick switching between tools feels like tabs, not navigation

### Gestures

- Edge swipes for auxiliary actions (chapter picker, contextual drawer)
- Never in-content swipes (interferes with text editing, scrolling)

### Chapter Switching

- Dropdown/modal for chapter picker (can't fit tabs on small screen)
- Recent chapters prioritised (reduce scrolling)

---

## Desktop-Specific Enhancements

### Multiple Simultaneous Views

- Editor + Right panel (Matched Tags, Outline) side-by-side
- Lorebook split view (list + editor)
- Brainstorm chat + Editor (future enhancement: side-by-side for reference)

### Keyboard Shortcuts

- Cmd+K: Command palette
- Cmd+1-6: Switch tools (Editor, Chapters, Lorebook, Brainstorm, Prompts, Notes)
- Cmd+J: Chapter picker
- Cmd+Shift+K: Toggle right panel
- Alt+S: Insert scene beat

### Window Management

- Collapsible sidebars (more writing space)
- Resizable panels (user preference)
- Layout state saved per-user (localStorage)

---

## Implementation Notes

### URL Structure

- Minimal routing: `/stories` (story list), `/story/:storyId` (workspace)
- Tool selection stored in UI state (not URL), or optional hash fragment (e.g., `#lorebook`)
- Chapter selection stored in UI state (or `?chapter=:chapterId` for deep linking)
- Avoids "navigation" feel of URL changes

### State Management

- Story workspace context provider (current story, current chapter, active tool)
- Tool switching updates context state, not router state
- TanStack Query for server data (stories, chapters, lorebook entries)
- Local state for UI (sidebar collapsed, right panel open, etc.)

### Performance

- Lazy load tool components (code splitting per tool)
- Chapter content cached (avoid refetch on switch)
- Debounced auto-save (editor content)
- Optimistic UI updates (instant feel)

### Libraries

- Command palette: `cmdk`
- Drag-and-drop: `@dnd-kit` (existing)
- Lexical editor: (existing)
- Modals/drawers: Radix UI primitives (existing via shadcn)

---

## Migration Strategy

### Phase 1: Core Workspace Structure

- Remove landing page, default to story list
- Story list entry points directly to workspace
- Implement workspace chrome (top bar, tool sidebar/toolbar)
- Chapter switching mechanism (top bar dropdown)
- Tool switching (sidebar/toolbar buttons → main content area swap)

### Phase 2: Tool Interfaces

- Refactor existing pages as tools (Lorebook, Brainstorm, Prompts, Notes, Chapters)
- Editor as default tool
- Remove navigation links, use tool switching
- State preservation (scroll position, last-edited chapter)

### Phase 3: Convenience Features

- Command palette (cmdk integration)
- Brainstorm → Lorebook entry creation
- Editor → Lorebook quick reference
- Chapter → New Lorebook entry
- Scene beat enhancements

### Phase 4: Mobile Optimisation

- Bottom toolbar for mobile
- Full-screen tool layouts
- Edge swipe gestures
- Touch-optimised UI (larger tap targets)

### Phase 5: Polish

- Visual cohesion (background colours, transitions)
- Keyboard shortcuts
- Onboarding tooltips
- Performance optimisation
- Accessibility audit

---

## Success Criteria

1. **Workspace feel** - User stays "in" story, never feels like navigating away
2. **Tool switching speed** - Instant (< 100ms perceived latency)
3. **Chapter switching speed** - < 2 seconds from any chapter to any other
4. **Context preservation** - Returning to editor shows exact position where user left off
5. **Mobile usability** - All tools usable full-screen, easy switching via toolbar
6. **Convenience workflows** - Common actions (Brainstorm → Lorebook) take < 5 taps

---

## Open Questions

1. **Desktop tool sidebar** - Fixed width or resizable? Collapsible to icon-only or fully hidden?

2. **Mobile bottom toolbar** - 4 primary tools + More menu, or 5 tools (squeeze in Notes/Prompts)?

3. **Right panel (desktop)** - Auto-open when Editor active, or always collapsed by default?

4. **Chapter tabs (desktop)** - Visible tab strip showing multiple open chapters, or just current chapter dropdown?

5. **Brainstorm split view** - Future enhancement to show Brainstorm + Editor side-by-side for reference while writing?

6. **Lorebook quick actions in Editor** - Select text → Right-click menu "Add to Lorebook", or FAB → modal?

7. **Tool state persistence** - Remember active tool per-story (return to Lorebook if that's where you left off), or always default to Editor?

8. **Series navigation** - Series remain in story list view (grouping toggle), or separate series workspace concept?

---

**End of Plan**
