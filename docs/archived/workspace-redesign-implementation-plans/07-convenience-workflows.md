# Plan #07: Convenience Workflows

**Dependencies:** #04 (all tools exist), #05 (right panel)

## Objective

Add convenience workflows that bridge tools without requiring manual navigation. Make common actions seamless and contextual.

## Core Workflows

### 1. Brainstorm → Lorebook Entry

**Use case:** User brainstorming character/location/plot, wants to save to lorebook without leaving chat

**Flow:**

1. User in Brainstorm tool, AI generates character description
2. Hover over message → action menu appears
3. Click "Add to Lorebook"
4. Modal opens with:
    - Content: prefilled with message text
    - Category: dropdown (character, location, item, etc.)
    - Title: text input
    - Tags: tag input
    - Hierarchy: global/series/story (pre-selected based on context)
5. Click Save → entry created in lorebook
6. Toast notification: "Lorebook entry created"
7. User stays in Brainstorm tool (no context switch)

**Optional:** "View Entry" button in toast → switches to Lorebook tool with entry selected

### 2. Editor Selection → Lorebook Entry

**Use case:** User writing, invents new character inline, wants to document in lorebook

**Flow:**

1. User in Editor, selects text (e.g., character name or description)
2. Right-click or toolbar button: "Add to Lorebook"
3. Modal opens (same as above, text prefilled)
4. Save → entry created
5. User stays in Editor

**Alternative trigger:** Keyboard shortcut (e.g., Cmd+Shift+L)

### 3. Lorebook Entry → Scene Beat (Indirect)

**Use case:** User views lorebook entry, wants to use it in scene beat

**Implementation:** Copy button in entry view

- User copies entry content
- Switches to Editor
- Inserts scene beat (Alt+S)
- Pastes copied content as command

**Enhancement (optional):** "Insert as Scene Beat" action

- Select chapter via modal
- Switches to Editor with that chapter
- Inserts scene beat with entry content

### 4. Brainstorm Message → Scene Beat

**Use case:** AI generates scene/description in brainstorm, user wants to use it directly in chapter

**Flow:**

1. User in Brainstorm, AI generates content
2. Message action menu: "Insert as Scene Beat"
3. Modal: "Select chapter" dropdown
4. Click Insert → switches to Editor with that chapter, scene beat inserted at cursor
5. User can accept/modify scene beat content

### 5. Editor → Quick Lorebook Reference

**Use case:** User writing, wants to check character detail without leaving editor

**Implementation:** Already in #05 (right panel Matched Tags view)

**Enhancement here:**

- Quick search in right panel
- Type character name → shows entry preview
- Click → expands full entry in panel
- No tool switching required

### 6. Chapter → New Lorebook Entry from Selection

**Use case:** User introduces new element in chapter, wants to document immediately

**Implementation:** Same as workflow #2 (Editor Selection → Lorebook Entry)

**Additional context:** Pre-fill category based on selection

- If selection matches common character name pattern → suggest "character"
- If selection is location-like → suggest "location"
- Simple heuristics, user can override

## Implementation Steps

### Brainstorm → Lorebook Entry

1. **Add action to brainstorm messages**
    - Message component has action menu (may already exist)
    - Add "Add to Lorebook" action

2. **Create CreateLorebookEntryModal**
    - Reusable modal for all "create entry" workflows
    - Props: prefilled content, suggested category, onSave callback
    - Form: title, content, tags, category, hierarchy
    - Uses `useCreateLorebookEntry` mutation

3. **Wire up action**
    - Click action → opens modal with message content prefilled
    - On save → creates entry, shows toast, stays in Brainstorm

4. **Test workflow**
    - Create entry from brainstorm message
    - Verify entry appears in Lorebook tool
    - Verify no tool switch

### Editor Selection → Lorebook Entry

1. **Add editor toolbar action or context menu**
    - Button in editor toolbar: "Add to Lorebook" (disabled if no selection)
    - Or: right-click context menu (may be complex with Lexical)

2. **Get selected text from Lexical**
    - Use Lexical selection API
    - Extract text content

3. **Open CreateLorebookEntryModal**
    - Prefill with selected text
    - User completes form, saves

4. **Test workflow**
    - Select text, create entry
    - Verify text prefilled
    - Verify entry created

### Brainstorm → Scene Beat

1. **Add message action: "Insert as Scene Beat"**
    - In message action menu

2. **Create ChapterPickerModal**
    - Lists all chapters for current story
    - User selects chapter

3. **Wire up flow**
    - Select chapter → `setCurrentChapterId(chapterId)`, `setCurrentTool('editor')`
    - On Editor mount, check if "pending scene beat content" in context
    - If yes, insert scene beat with that content
    - Clear pending content

4. **Test workflow**
    - Insert from brainstorm
    - Verify switches to Editor
    - Verify scene beat inserted

### Quick Lorebook Search (Right Panel Enhancement)

1. **Add search input to right panel**
    - In Matched Tags view or separate tab

2. **Implement search**
    - Filter lorebook entries by query
    - Show results in panel
    - Click result → expands preview

3. **Test**
    - Search works
    - Results accurate
    - No performance issues

### Auto-suggest Category

1. **Add heuristic to CreateLorebookEntryModal**
    - Check selected text for patterns
    - Capitalized names → "character"
    - Location keywords → "location"
    - Pre-select category in dropdown

2. **User can override**
    - Suggestion is just default, not forced

## Technical Considerations

### Context for Pending Actions

**Problem:** Brainstorm → Scene Beat requires passing content between tools

**Solution A:** Workspace context

```typescript
WorkspaceContext {
  ...
  pendingSceneBeatContent?: string
  setPendingSceneBeatContent: (content: string | undefined) => void
}
```

**Solution B:** URL state

```typescript
navigate(`/?tool=editor&chapterId=${id}&sceneBeatContent=${encodeURIComponent(content)}`);
```

**Recommendation:** Solution A (cleaner, fits stateless model)

### Modal Reusability

**CreateLorebookEntryModal should be reusable:**

- Used from Brainstorm tool
- Used from Editor tool
- Used from anywhere else

**Props:**

```typescript
interface CreateLorebookEntryModalProps {
    open: boolean;
    onClose: () => void;
    defaultContent?: string;
    defaultTitle?: string;
    defaultCategory?: LorebookCategory;
    suggestedCategory?: LorebookCategory;
    onSuccess?: () => void;
}
```

### Editor Context Menu

**Challenge:** Adding context menu to Lexical editor

**Options:**

- A: Custom Lexical plugin for context menu
- B: Native browser context menu (limited styling)
- C: Toolbar button only (simpler, more discoverable)

**Recommendation:** Start with C (toolbar button), add context menu later if needed

### Toast Notifications

**Use existing:** react-toastify (project dependency)

**Toast actions:**

- Success: "Lorebook entry created"
- Action button: "View Entry" → switches to Lorebook with entry selected
- Dismiss after 5s or manual close

## Testing Criteria

### Brainstorm → Lorebook

- [ ] Action appears on brainstorm messages
- [ ] Modal opens with message content prefilled
- [ ] All form fields work
- [ ] Save creates entry correctly
- [ ] Toast notification appears
- [ ] User stays in Brainstorm tool
- [ ] "View Entry" action switches to Lorebook with entry selected

### Editor → Lorebook

- [ ] Toolbar button enabled when text selected
- [ ] Modal opens with selected text
- [ ] Entry created correctly
- [ ] User stays in Editor
- [ ] Selection preserved after modal close

### Brainstorm → Scene Beat

- [ ] Action appears on messages
- [ ] Chapter picker modal works
- [ ] Selecting chapter switches to Editor with that chapter
- [ ] Scene beat inserted with message content
- [ ] Content can be accepted/edited

### Quick Lorebook Search

- [ ] Search input in right panel works
- [ ] Results filter correctly
- [ ] Click result shows entry preview
- [ ] Performance acceptable

### Technical

- [ ] Zero lint errors
- [ ] Zero build errors
- [ ] No console errors
- [ ] Modals accessible and keyboard-navigable
- [ ] Toast notifications work correctly

## Known Enhancements

**Future improvements:**

- Drag-and-drop brainstorm message to Lorebook tool
- Multi-select in editor → create multiple entries
- AI-assist category detection (ML-based, not just heuristics)
- Template-based entry creation
- Bulk actions

## Notes for Implementer

**Do:**

- Make modals reusable
- Test cross-tool workflows thoroughly
- Verify state transitions work correctly
- Check toast notification UX

**Don't:**

- Over-complicate with too many options
- Break existing tool functionality
- Make workflows too many steps
- Forget edge cases (no story selected, empty content, etc.)

## Success Criteria

**After this plan:**

- All convenience workflows implemented
- Brainstorm → Lorebook seamless
- Editor → Lorebook seamless
- Brainstorm → Scene Beat works
- Quick search in right panel functional
- All workflows feel natural and save time
- Zero regressions in tool functionality
- Users can stay in flow without manual navigation
