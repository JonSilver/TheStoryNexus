# Plan #02: Stories Tool

**Dependencies:** #01 (workspace shell must exist)

## Objective

Implement Stories tool - the story and series management interface. This is where users create, select, and manage stories. Clicking a story loads it and switches to Editor tool.

## Architectural Changes

### What Stories Tool Replaces

**Current:**

- Landing page at `/`
- Story list page at `/stories`
- Series list page at `/series`
- Story dashboard at `/dashboard/:storyId`

**Target:**

- All of this becomes the Stories tool
- No separate pages
- Series and story management unified in one tool interface
- Story dashboard functionality distributed across workspace (editing story details in Stories tool, other features in their respective tools)

### Stories Tool Interface

**Main content area shows:**

1. Series/story list view (primary)
2. Story creation form (modal or slide-in panel)
3. Series creation form (modal or slide-in panel)
4. Story edit panel (modal or slide-in panel)

**Key interaction:**

- Click story card/row → `setCurrentStoryId(story.id)`, `setCurrentTool('editor')`
- "Continue" button on story → same as clicking story
- Edit story button → opens story edit panel within Stories tool
- Create story → opens creation form, on submit switches to Editor with new story
- Series grouping toggle → show stories grouped by series vs flat list

### Story Selection Flow

**User flow:**

1. User in Stories tool
2. Sees list of stories (optionally grouped by series)
3. Clicks story → story loads, Editor tool activates, first chapter opens
4. User now in Editor writing
5. Wants different story → clicks Stories tool → back to list → selects different story

**Top bar quick switcher:**

- Once story selected, story name appears in top bar
- Click → dropdown of all stories for quick switching
- Select from dropdown → `setCurrentStoryId(newId)`, stays on current tool
- Allows switching stories without going back to Stories tool

## Functionality to Preserve

**Must preserve ALL existing functionality:**

### Series Management

- [ ] Create new series (name, description)
- [ ] Edit series details
- [ ] Delete series (with confirmation)
- [ ] View stories in series
- [ ] Toggle grouping by series in list

### Story Management

- [ ] Create story (standalone or in series)
- [ ] Edit story details (title, synopsis, language setting, etc.)
- [ ] Delete story (with confirmation, cascade delete chapters/lorebook/etc.)
- [ ] View story metadata (word count, last edited, chapter count)
- [ ] Filter/search stories
- [ ] Sort stories (by date, title, etc.)

### Story Creation Flows

- [ ] Create standalone story
- [ ] Create story in existing series
- [ ] Create series and story together
- [ ] Demo story loading/creation

### Export/Import (if currently in dashboard)

- [ ] Export story
- [ ] Import story
- [ ] Export series
- [ ] Import series
- [ ] Lorebook import/export
      _Where does this functionality currently live? If in story dashboard, move to Stories tool. If in respective tools (Lorebook tool for lorebook export), leave there._

### Story Dashboard Features to Migrate

**Current story dashboard likely has:**

- Story title/synopsis display
- Edit story button
- Export story button
- Delete story button
- Navigation to chapters/lorebook/etc. (now replaced by tool switching)

**Where this goes:**

- Story details → Stories tool (edit story panel)
- Export → Stories tool or specific tools
- Delete → Stories tool
- Navigation → removed (use tool switching)

## Key Technical Decisions

### UI Layout Options

**Option A: Card grid**

- Story cards in grid layout
- Each card: title, synopsis snippet, word count, last edited
- Actions on hover/click (edit, delete, export)
- Series shown as sections or tabs

**Option B: List view**

- Story rows in table/list
- Columns: title, series, word count, last edited, actions
- Series collapsible groups

**Option C: Hybrid**

- Series shown as expandable cards
- Stories within series as list rows
- Standalone stories as cards

**Recommendation:** Option A for visual appeal, or Option C for organization. Implementer's choice based on existing UI patterns.

### Story Selection Mechanism

When user clicks story:

```typescript
const handleStoryClick = (storyId: string) => {
    setCurrentStoryId(storyId);
    setCurrentTool("editor");
    // localStorage persistence happens in context
};
```

Simple state update, no navigation.

### Editing vs Viewing

**View mode (default):**

- List of stories
- Quick actions visible

**Edit mode:**

- Modal or slide-in panel
- Form for story details
- Save/cancel buttons
- On save, stays in Stories tool (doesn't switch to Editor unless user clicks story)

### Series Grouping State

**Decision:** Should series grouping toggle be:

- A: Persisted in localStorage (remembers preference)
- B: Session-only (resets on reload)

**Recommendation:** Persist for better UX.

## Integration Points

### Data Fetching

- `useStoriesQuery()` - fetch all stories
- `useSeriesQuery()` - fetch all series
- `useStoryQuery(id)` - fetch specific story details
- Mutations: `useCreateStory`, `useUpdateStory`, `useDeleteStory`, etc.

All already exist in existing code - reuse them.

### Story Context

- When story selected, fetch story data for display
- Store in workspace context or fetch separately in each tool
- **Decision:** Fetch in workspace (top bar needs it), tools can access via context or refetch

### Chapter Initialization

- When story selected and Editor tool activates, need to initialize currentChapterId
- **Where:** Editor tool checks if currentChapterId is set, if not, sets to first chapter
- Don't do this in Stories tool (separation of concerns)

## Implementation Steps

1. **Identify existing components**
    - Find current story list component
    - Find series list component
    - Find story creation form
    - Find story edit form
    - Assess if they can be reused or need refactoring

2. **Create Stories tool component structure**
    - `StoriesTool.tsx` - main container
    - `StoryList.tsx` - list view (if doesn't exist)
    - `StoryCard.tsx` - story card component (if doesn't exist)
    - `SeriesSection.tsx` - series grouping (if doesn't exist)
    - `StoryCreateModal.tsx` - creation form
    - `StoryEditModal.tsx` - edit form
    - Reuse existing components where possible

3. **Wire up story selection**
    - Click handler calls `setCurrentStoryId` and `setCurrentTool('editor')`
    - Test state updates correctly

4. **Implement quick story switcher in top bar**
    - Dropdown showing all stories
    - Current story highlighted
    - Click story in dropdown updates currentStoryId
    - Doesn't change tool (stays on whatever tool you're in)

5. **Migrate story/series CRUD**
    - Ensure create/edit/delete all work within Stories tool
    - No navigation, no route changes
    - Modals or panels for forms

6. **Handle empty states**
    - No stories: "Create your first story" CTA
    - No series: "Create a series" CTA
    - Demo content option

7. **Update Workspace MainContent**
    - Add `case 'stories':` → render StoriesTool
    - Remove placeholder

8. **Remove old routes**
    - Remove `/stories` route
    - Remove `/series` route
    - Remove `/` landing page route
    - Remove story dashboard route (or keep temporarily for #03-#08)
    - Redirect old routes to `/` (workspace)

## Testing Criteria

### Functional

- [ ] Stories tool shows all stories
- [ ] Series grouping works (if applicable)
- [ ] Click story → loads story, switches to Editor, opens first chapter
- [ ] Create story works
- [ ] Edit story works
- [ ] Delete story works (with confirmation)
- [ ] Create series works
- [ ] Edit series works
- [ ] Delete series works
- [ ] Top bar shows current story name when story selected
- [ ] Top bar dropdown shows all stories for quick switching
- [ ] Switching story via dropdown updates context, stays on current tool
- [ ] Empty state shows when no stories
- [ ] Demo content works (if applicable)
- [ ] Search/filter works (if exists)
- [ ] Sort works (if exists)

### Technical

- [ ] Zero lint errors
- [ ] Zero build errors
- [ ] No console errors
- [ ] Story queries work correctly
- [ ] Mutations work correctly
- [ ] localStorage persistence works
- [ ] Old routes removed or redirected
- [ ] No broken links

## Migration Checklist

**Features from old pages that MUST work in Stories tool:**

From `/stories` page:

- [ ] List all stories
- [ ] Create new story
- [ ] Search stories
- [ ] Filter stories
- [ ] Sort stories

From `/series` page:

- [ ] List all series
- [ ] Create new series
- [ ] View stories in series
- [ ] Edit series
- [ ] Delete series

From story dashboard:

- [ ] Edit story details
- [ ] Delete story
- [ ] Export story
- [ ] View story metadata
- _(Note: Chapter/lorebook/etc. navigation replaced by tool switching)_

From landing page:

- [ ] Access to stories (now default view if no story selected)
- [ ] AI settings configuration (now in top bar)
- [ ] User guide access (now in top bar)
- _(Note: Landing was probably minimal, most functionality already in /stories)_

## Known Limitations

**Resolved in later plans:**

- Editor tool not implemented yet → #03
- Clicking story won't do anything useful until Editor exists
- Other tools not implemented → #04-#08

## Notes for Implementer

**Do:**

- Reuse existing story/series components where possible
- Test story selection flow thoroughly
- Verify all CRUD operations work
- Check empty states
- Test quick switcher in top bar

**Don't:**

- Rebuild components from scratch if existing ones work
- Remove old routes until Stories tool fully working
- Break existing functionality
- Forget export/import features

## Success Criteria

**After this plan:**

- Stories tool fully functional
- All series/story management works
- Story selection updates context and switches to Editor tool (even if Editor is still placeholder)
- Top bar quick switcher works
- Old routes cleaned up (stories, series, landing)
- Zero functionality lost from migration
- Foundation ready for Editor tool implementation (#03)
