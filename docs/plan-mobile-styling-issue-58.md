# Mobile Styling Improvements Plan

**Issue:** #58 - Mobile UI is a bit dodgy
**Related:** #57 - Manifest should support app mode (reduces available viewport)

## Summary of Problems

Testing on iPhone reveals several mobile styling issues:

1. **Editor toolbar** overflows screen, buttons become inaccessible
2. **Lorebook and other screens** scroll horizontally but content is clipped by header/footer
3. Browser chrome (address bar, navigation) further reduces available viewport

---

## Problem Areas & Proposed Solutions

### 1. Editor Toolbar Overflow

**Location:** `src/Lexical/lexical-playground/src/plugins/ToolbarPlugin/index.tsx:595`
**CSS:** `src/Lexical/lexical-playground/src/index.css:1444-1446`

**Problem:**
Single-row toolbar with ~12 buttons/dropdowns doesn't fit on iPhone width (~375px). Uses `overflow-x: auto` which makes buttons scrollable but the word count and maximise button (using `ml-auto`) get pushed off-screen entirely.

**Solution:**

- Hide less-essential toolbar items on mobile (font family, font size controls)
- Collapse multiple items into an overflow menu on narrow screens
- Move word count to a less prominent position or hide on mobile
- Consider two-row toolbar layout for mobile

### 2. Notes Sheet Too Wide

**Location:** `src/features/chapters/components/StoryEditor.tsx:158`

**Problem:**
`min-w-[800px]` on SheetContent makes notes panel unusable on mobile.

**Solution:**

- Replace fixed `min-w-[800px]` with responsive classes: `w-full md:min-w-[600px] lg:min-w-[800px]`

### 3. Editor Right Sidebar Inaccessible on Mobile

**Location:** `src/features/chapters/components/StoryEditor.tsx:51-96`

**Problem:**
Right sidebar with Tags, Outline, POV, Notes buttons is `hidden md:flex`. Mobile users have no way to access these features.

**Solution:**

- Add mobile-specific buttons/menu in the TopBar or as floating action buttons
- Or add these options to the mobile bottom toolbar contextually when on editor tool

### 4. MainLayout Fixed Sidebar

**Location:** `src/components/MainLayout.tsx:10-32`

**Problem:**
Fixed `w-12` sidebar and `ml-12` content offset consume space on mobile. This layout is for non-workspace pages but still affects mobile.

**Solution:**

- Hide sidebar on mobile: `hidden md:flex`
- Remove content offset on mobile: `ml-0 md:ml-12`
- Add alternative mobile navigation if needed

### 5. TopBar Crowding

**Location:** `src/components/workspace/TopBar.tsx:27-116`

**Problem:**
TopBar contains app title, story selector, chapter switcher, and 4 action buttons. On narrow screens, these overflow or truncate poorly.

**Solution:**

- Hide "Story Nexus" text on mobile, or make it shorter
- Collapse action buttons into a menu on narrow screens
- Ensure chapter/story selectors truncate gracefully

### 6. Mobile Bottom Toolbar Density

**Location:** `src/components/workspace/Sidebar.tsx:92-117`

**Problem:**
8 tool buttons with icons AND text labels may not fit comfortably on iPhone SE (~320px) or smaller screens.

**Solution:**

- Hide text labels on very small screens, icons-only
- Consider grouping less-used tools under a "more" option
- Use `text-[10px]` on smaller breakpoints

### 7. LorebookPage Layout Issues

**Location:** `src/features/lorebook/pages/LorebookPage.tsx:107-181`

**Problem:**

- `p-6` padding excessive on mobile
- Header row with title + 3 buttons doesn't wrap
- 8 category tabs don't fit on narrow screens

**Solution:**

- Reduce padding: `p-4 md:p-6`
- Make header responsive: stack on mobile, row on desktop
- Tab buttons: smaller text, scroll horizontally, or convert to dropdown on mobile

### 8. Content Clipping Behind Header/Footer

**Problem:**
Sticky header (h-14, z-40) + fixed bottom nav (z-50) clip content. Some tools may not account for these correctly.

**Solution:**

- Ensure all tool containers use appropriate padding: `pt-14` if not in scroll container
- Verify `pb-16 md:pb-0` is consistently applied to scrollable areas
- Audit each tool component for viewport calculation issues

---

## Implementation Priority

### Phase 1: Critical Fixes (Blocking Usability)

1. Editor toolbar - collapse/hide items on mobile
2. Notes sheet - fix min-width
3. MainLayout sidebar - hide on mobile

### Phase 2: Important Improvements

4. TopBar - responsive layout
5. LorebookPage - responsive header and tabs
6. Right sidebar features - mobile access

### Phase 3: Polish

7. Mobile bottom toolbar - icons-only option
8. Content clipping audit - padding consistency

---

## Testing Checklist

After implementation, verify on:

- [ ] iPhone SE (320px width)
- [ ] iPhone 14/15 (390px width)
- [ ] iPad Mini (portrait ~768px)
- [ ] Chrome DevTools mobile emulation

Test each screen:

- [ ] Editor - toolbar usable, content not clipped
- [ ] Lorebook - tabs accessible, no horizontal scroll
- [ ] Chapters list - fully visible
- [ ] Brainstorm - chat input accessible
- [ ] Settings - forms usable
- [ ] All drawers/sheets - fit screen

---

## Notes

- #57 (PWA manifest) would help by removing Safari chrome in standalone mode
- Consider adding viewport meta tag verification: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">`
- Test with iOS Safari's "Add to Home Screen" once #57 is implemented
