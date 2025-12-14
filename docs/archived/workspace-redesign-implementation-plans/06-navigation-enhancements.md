# Plan #06: Command Palette & Keyboard Shortcuts

**Dependencies:** #04 (all tools must exist)

## Objective

Add command palette for unified search/navigation and comprehensive keyboard shortcuts for power users. Makes workspace feel more like a professional tool (VS Code style).

## Command Palette Architecture

### Purpose
Single search interface for all workspace actions:
- Jump to story
- Jump to chapter
- Open lorebook entry
- Open prompt
- Open note
- Switch tools
- Execute actions (create story, create chapter, etc.)

### Library
Use `cmdk` (command-k) - battle-tested, accessible, keyboard-first

### Trigger
- Keyboard: Cmd+K (Mac) / Ctrl+K (Windows/Linux)
- UI: Search icon in top bar (mobile-friendly)

### Command Structure

**Grouped by category:**
1. **Stories** - "Open [Story Name]", "Create Story"
2. **Chapters** - "Jump to [Chapter Name]", "Create Chapter"
3. **Lorebook** - "View [Entry Name]", "Create Entry"
4. **Prompts** - "Edit [Prompt Name]", "Create Prompt"
5. **Notes** - "Open [Note Name]", "Create Note"
6. **Tools** - "Go to Editor", "Go to Chapters", etc.
7. **Actions** - "Export Story", "AI Settings", etc.

**Command format:**
```typescript
{
  id: string
  label: string  // Display text
  category: string  // For grouping
  keywords: string[]  // For search matching
  action: () => void  // What happens when selected
  icon?: ReactNode  // Optional icon
}
```

### Search Behavior
- Fuzzy search (built into cmdk)
- Search across label + keywords
- Keyboard navigation (up/down arrows)
- Enter to execute
- Esc to close

### Example Commands

**Stories:**
- "Open: My Fantasy Novel" → opens story (setCurrentStoryId, setCurrentTool('editor'))
- "Create Story" → opens create story form in Stories tool
- "Switch to [Story Name]" → quick story switcher

**Chapters:**
- "Jump to Chapter 1: The Beginning" → sets chapter, switches to Editor
- "Create Chapter" → creates new chapter
- "Next Chapter" → navigates to next chapter
- "Previous Chapter" → navigates to previous chapter

**Lorebook:**
- "View: Aragorn" → opens Lorebook tool with entry selected
- "Create Character" → creates new character entry
- "Create Location" → creates new location entry

**Tools:**
- "Go to Editor" → setCurrentTool('editor')
- "Go to Stories" → setCurrentTool('stories')
- "Go to Lorebook" → setCurrentTool('lorebook')
- etc.

**Actions:**
- "Export Story" → triggers export
- "Import Story" → triggers import
- "AI Settings" → opens AI settings modal
- "User Guide" → opens guide
- "Toggle Right Panel" → toggles editor right panel (#05)

## Keyboard Shortcuts Architecture

### Shortcut Categories

**1. Tool Navigation**
- Cmd/Ctrl + 1: Stories tool
- Cmd/Ctrl + 2: Editor tool
- Cmd/Ctrl + 3: Chapters tool
- Cmd/Ctrl + 4: Lorebook tool
- Cmd/Ctrl + 5: Brainstorm tool
- Cmd/Ctrl + 6: Prompts tool
- Cmd/Ctrl + 7: Notes tool

**2. Chapter Navigation**
- Cmd/Ctrl + J: Open chapter switcher
- Cmd/Ctrl + ]: Next chapter
- Cmd/Ctrl + [: Previous chapter

**3. Search & Navigation**
- Cmd/Ctrl + K: Command palette
- Cmd/Ctrl + P: Quick story switcher (alternative)

**4. Editor Actions**
- Cmd/Ctrl + S: Save (probably already exists via Lexical)
- Cmd/Ctrl + Shift + K: Toggle right panel
- Alt/Option + S: Insert scene beat (existing)

**5. Creation Actions**
- Cmd/Ctrl + N: Context-dependent "new" action
  - In Stories: New story
  - In Chapters: New chapter
  - In Lorebook: New entry
  - In Prompts: New prompt
  - In Notes: New note

**6. Global Actions**
- Cmd/Ctrl + ,: Settings
- Cmd/Ctrl + /: User guide
- Esc: Close modals/drawers

### Implementation Strategy

**Library:** Use existing keyboard handling or lightweight library
- Option A: Manual event listeners (simple but tedious)
- Option B: react-hotkeys-hook (lightweight, maintained)
- Option C: Built into cmdk for palette, manual for others

**Recommendation:** react-hotkeys-hook for cleaner code

**Conflict Prevention:**
- Check existing Lexical shortcuts (don't override editor shortcuts)
- Make shortcuts configurable (optional enhancement)
- Document all shortcuts

### Keyboard Shortcut Display

**User-facing documentation:**
- Help modal (Cmd+/ or ?) showing all shortcuts
- Tooltip hints on buttons (show shortcut)
- Keyboard symbols (⌘ ⇧ ⌃ ⌥ on Mac, Ctrl Shift Alt on Windows)

**In command palette:**
- Show shortcuts next to command labels
- Example: "Go to Editor" → "⌘2"

## Implementation Steps

### Command Palette

1. **Install cmdk**
   ```bash
   npm install cmdk
   ```

2. **Create CommandPalette component**
   - Modal with cmdk component
   - Open/close state
   - Keyboard trigger (Cmd+K)
   - UI trigger (search icon in top bar)

3. **Build command registry**
   - Dynamic command generation
   - Stories from `useStoriesQuery`
   - Chapters from `useChaptersQuery(currentStoryId)`
   - Lorebook entries from `useLorebookQuery(currentStoryId)`
   - Prompts from `usePromptsQuery`
   - Notes from `useNotesQuery(currentStoryId)`
   - Static commands (tools, actions)

4. **Implement command actions**
   - Each command has action function
   - Uses workspace context (setCurrentTool, setCurrentStoryId, etc.)
   - Some open modals, some navigate, some execute mutations

5. **Add search icon to top bar**
   - Opens command palette on click
   - Mobile-friendly alternative to Cmd+K

6. **Test command palette**
   - All commands execute correctly
   - Search works (fuzzy matching)
   - Keyboard navigation works
   - Categories group correctly

### Keyboard Shortcuts

1. **Install react-hotkeys-hook** (if using)
   ```bash
   npm install react-hotkeys-hook
   ```

2. **Create useKeyboardShortcuts hook**
   - Central hook for all shortcuts
   - Uses workspace context
   - Registers all shortcuts on mount

3. **Implement tool navigation shortcuts**
   - Cmd+1-7 for tools
   - Use setCurrentTool from context

4. **Implement chapter navigation shortcuts**
   - Cmd+J for chapter switcher
   - Cmd+] and Cmd+[ for next/prev chapter

5. **Implement creation shortcuts**
   - Cmd+N context-dependent
   - Check currentTool, execute appropriate action

6. **Implement editor shortcuts**
   - Cmd+Shift+K toggle right panel
   - Check doesn't conflict with Lexical

7. **Create shortcuts help modal**
   - Component showing all shortcuts
   - Trigger with Cmd+/ or ? key
   - Grouped by category
   - Show platform-specific symbols

8. **Add keyboard hints to UI**
   - Tooltips showing shortcuts
   - Command palette shows shortcuts next to labels

9. **Test shortcuts**
   - All shortcuts work
   - No conflicts with browser/Lexical
   - Cross-platform (Mac, Windows, Linux)

## Technical Considerations

### Shortcut Conflicts

**With browser:**
- Cmd+T (new tab) - avoid
- Cmd+W (close window) - avoid
- Cmd+R (reload) - avoid
- Cmd+L (address bar) - avoid

**With Lexical editor:**
- Check existing Lexical shortcuts
- Don't override editor formatting shortcuts
- Scope shortcuts appropriately (global vs editor-only)

**Solution:** Scoped shortcuts
- Some shortcuts only active outside editor
- Editor has own shortcut context
- Use `preventDefault()` carefully

### Platform Detection

**Keyboard symbols:**
- Mac: ⌘ (Cmd), ⇧ (Shift), ⌥ (Option), ⌃ (Control)
- Windows/Linux: Ctrl, Shift, Alt

**Detection:**
```typescript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const modKey = isMac ? '⌘' : 'Ctrl'
```

### Accessibility

**Command palette:**
- Fully keyboard navigable
- Screen reader friendly (cmdk handles this)
- Focus management on open/close

**Shortcuts:**
- Don't rely solely on shortcuts (always have mouse alternative)
- Document shortcuts clearly
- Allow discovery (help modal)

## Testing Criteria

### Command Palette
- [ ] Opens with Cmd+K
- [ ] Opens with search icon click
- [ ] Shows all command categories
- [ ] Search works (fuzzy matching)
- [ ] Keyboard navigation works (up/down/enter)
- [ ] Commands execute correctly (story open, tool switch, etc.)
- [ ] Closes with Esc
- [ ] Mobile-friendly (touch interaction)
- [ ] No console errors

### Keyboard Shortcuts
- [ ] All tool navigation shortcuts work (Cmd+1-7)
- [ ] Chapter navigation shortcuts work (Cmd+J, Cmd+], Cmd+[)
- [ ] Creation shortcut works (Cmd+N, context-dependent)
- [ ] Editor shortcuts work (Cmd+Shift+K)
- [ ] Global shortcuts work (Cmd+K, Cmd+/, Cmd+,)
- [ ] No conflicts with browser shortcuts
- [ ] No conflicts with Lexical shortcuts
- [ ] Cross-platform (Mac, Windows, Linux)
- [ ] Help modal shows all shortcuts
- [ ] Tooltips show shortcuts where applicable

### Technical
- [ ] Zero lint errors
- [ ] Zero build errors
- [ ] No console errors
- [ ] Performance acceptable (command palette search fast)
- [ ] Keyboard event listeners cleaned up properly

## Known Limitations

**Future enhancements:**
- Configurable shortcuts (user-defined key bindings)
- Command history (recent commands)
- Command execution count / analytics
- More granular actions (e.g., "Bold selection" in editor)

## Notes for Implementer

**Do:**
- Test shortcuts thoroughly on all platforms
- Check Lexical documentation for existing shortcuts
- Make sure command palette search is fast
- Provide help/documentation for shortcuts
- Test mobile command palette experience

**Don't:**
- Override essential browser shortcuts
- Break Lexical editor shortcuts
- Make shortcuts too complex
- Forget accessibility
- Skip help documentation

## Success Criteria

**After this plan:**
- Command palette fully functional
- All keyboard shortcuts working
- Help modal documents all shortcuts
- Cross-platform compatibility
- Mobile command palette works
- Power users can navigate entirely via keyboard
- Discovery mechanisms in place (help modal, tooltips)
- Zero conflicts with existing shortcuts
- Enhanced productivity and workspace feel
