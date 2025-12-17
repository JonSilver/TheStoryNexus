# Mobile-Responsive Refactor Plan

## Overview

Convert The Story Nexus from desktop-only to mobile-first responsive design using existing Tailwind CSS and Shadcn UI components. Current state: app unusable on mobile with fixed sidebars, small touch targets, and desktop-only interaction patterns.

## Strategy

- **Mobile-first approach**: Base styles for mobile, layer desktop enhancements via Tailwind breakpoints
- **Component reuse**: Leverage existing Drawer, Sheet, Dialog components for mobile variants
- **CSS-driven**: Pure Tailwind responsive utilities, minimal/no JS device detection
- **Unified components**: Single components with responsive variants, not separate mobile/desktop versions

## Phase 1: Navigation Architecture

### Main App Navigation (MainLayout)

**Current**: Fixed 48px left sidebar with icon navigation
**Target**:

- Mobile: Bottom navigation bar (5 key sections)
- Desktop: Existing left sidebar

**Changes**:

- Add responsive bottom nav component
- Hide left sidebar on mobile (`hidden md:block`)
- Ensure thumb-friendly touch targets (44px minimum)

### Story Dashboard Navigation (StoryDashboard)

**Current**: Collapsible left sidebar (150px/48px)
**Target**:

- Mobile: Bottom nav + hamburger menu Sheet for secondary actions
- Tablet: Collapsible overlay Sheet
- Desktop: Existing sidebar behaviour

**Changes**:

- Bottom nav for primary routes (Chapters, Lorebook, Prompts, Brainstorm, Notes)
- Hamburger Sheet for settings/theme/home
- Unified navigation component with responsive layout

## Phase 2: Sidebar Elimination

### Story Editor Right Sidebar (StoryEditor)

**Current**: Fixed 192px right sidebar with tool buttons
**Target**:

- Mobile: Hidden, tools accessible via bottom sheet Drawer
- Desktop: Existing sidebar

**Changes**:

- Hide sidebar on mobile
- Expose tools via floating action button → Drawer
- Existing Drawer components already used for panels (Matched Tags, Outline, POV) - maintain

### Feature Sidebars (ChatList, NoteList, PromptsManager)

**Current**: Fixed-width sidebars (250-300px)
**Target**:

- Mobile: Dropdown select or Sheet overlay
- Desktop: Existing sidebar

**Pattern**: Create unified `ResponsiveSidebar` component handling:

- Mobile: Sheet overlay with trigger button
- Desktop: Fixed sidebar with collapse

**Changes**:

- Extract common sidebar pattern
- Apply to Brainstorm, Notes, Prompts pages
- Entity selection via compact header dropdown on mobile

## Phase 3: Entity Selection & Lists

### Chapter List

**Current**: Drag-drop cards, desktop-optimized
**Target**: Touch-friendly with visible action buttons on mobile

**Changes**:

- Always-visible action buttons on mobile (no hover dependency)
- Touch-friendly drag handles
- Maintain existing responsive grid

### Lorebook

**Current**: Tab navigation with responsive grid (already good)
**Target**: Convert tabs to dropdown select on mobile

**Changes**:

- Replace horizontal tabs with Select component on mobile
- Maintain grid layout (already responsive)
- Keep desktop tabs

### Chat/Note Lists

**Target**: Swipe or tap-to-reveal actions on mobile

**Changes**:

- Replace hover actions with touch-friendly alternatives
- Consider swipe gestures or always-visible buttons

## Phase 4: Lexical Editor

### Toolbar

**Current**: Dense fixed toolbar, hover-based format toolbar
**Target**:

- Mobile: Simplified toolbar with overflow menu, tap-based format controls
- Desktop: Existing toolbar

**Changes**:

- Responsive toolbar with essential tools visible, overflow menu for rest
- Replace floating format toolbar with bottom sheet on mobile
- Touch-friendly button sizing

### Scene Beat Controls

**Current**: Inline controls with multiple buttons
**Target**: Simplified mobile interface

**Changes**:

- Consolidate actions into menu on mobile
- Maintain inline controls on desktop
- Ensure touch targets meet 44px minimum

## Phase 5: Touch Optimization

### Global Touch Targets

- Audit all buttons/interactive elements for 44px minimum
- Add responsive sizing: `h-11 w-11 md:h-9 md:w-9` pattern

### Interaction Patterns

- Replace hover-dependent UI with tap-to-reveal or always-visible on mobile
- Remove tooltip dependency on mobile (tap to show or omit)
- Ensure form inputs are touch-friendly

### Spacing & Typography

- Add touch-friendly padding throughout
- Responsive font sizes where needed
- Adequate spacing between interactive elements

## Component Architecture

### New Shared Components

1. **ResponsiveNavigation**
    - Bottom nav for mobile
    - Sidebar for desktop
    - Reusable across MainLayout and StoryDashboard

2. **ResponsiveSidebar**
    - Sheet overlay for mobile
    - Fixed sidebar for desktop
    - Handles collapse state
    - Used by ChatList, NoteList, PromptsManager

3. **MobileEntitySelector**
    - Dropdown select for mobile
    - Tabs/list for desktop
    - Generic for chapters, notes, chats, lorebook categories

### Component Modifications

1. **Sheet component** - Add width constraints for mobile
2. **Drawer component** - Already good, expand usage
3. **Dialog component** - Already responsive, no changes
4. **Button component** - Add touch-size variants

## Tailwind Patterns

### Breakpoint Strategy

Use existing Tailwind defaults:

- Base: Mobile (< 640px)
- `sm:`: 640px+ (large phones, small tablets)
- `md:`: 768px+ (tablets, small laptops)
- `lg:`: 1024px+ (laptops, desktops)

### Common Patterns

```
hidden md:block              // Hide on mobile, show on desktop
flex-col md:flex-row         // Stack on mobile, horizontal on desktop
w-full md:w-64               // Full width mobile, fixed desktop
fixed bottom-0 md:left-0     // Bottom mobile, left desktop
```

## Risk Mitigation

### High-Risk Areas

- **Lexical editor**: Complex, may require iterative refinement
- **Scene beat controls**: Dense UI, test thoroughly on actual devices
- **Drag-and-drop**: Ensure touch handlers work correctly

### Testing Strategy

- Test on actual mobile devices, not just browser DevTools
- Verify touch targets with thumb navigation
- Check landscape and portrait orientations
- Test on various screen sizes (small phones to tablets)

## Implementation Order

1. **Navigation** (MainLayout, StoryDashboard) - Most impactful for mobile usability
2. **Sidebars** (ChatList, NoteList, PromptsManager) - Unify pattern, apply across features
3. **Entity selection** (Chapters, Lorebook) - Improve list interactions
4. **Editor** (Toolbar, Scene beats) - Most complex, iterate based on testing
5. **Polish** (Touch targets, spacing, typography) - Final refinement

## Success Criteria

- App fully navigable on mobile without horizontal scroll
- All interactive elements have 44px minimum touch targets
- No hover-dependent interactions on touch devices
- Sidebars hidden or minimal on mobile, accessible via menus
- Primary content uses full screen width on mobile
- All features accessible and usable on phones (not just "works" but genuinely usable)

## Out of Scope

- Platform-specific native features
- Separate mobile-only routes or pages
- Mobile app wrappers (Capacitor, etc.)
- Gesture libraries beyond basic tap/swipe
- Mobile-specific database optimizations
