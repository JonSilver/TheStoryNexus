# Dependency Upgrade Plan

Systematic upgrade of all outdated dependencies with research, remediation, and verification steps.

---

## Phase 1: Safe Updates (Patch/Minor within range)

### 1.1 ESLint Ecosystem
**Packages:** `@eslint/js` 9.39.1→9.39.2, `eslint` 9.39.1→9.39.2, `eslint-plugin-playwright` 2.3.0→2.4.0

**Research:** Patch releases, changelog review unlikely to reveal breaking changes.

**Upgrade:** `npm update @eslint/js eslint eslint-plugin-playwright`

**Verification:** `npm run lint` passes

---

### 1.2 TanStack Query
**Package:** `@tanstack/react-query` 5.90.6→5.90.12

**Research:** Patch release within v5.

**Upgrade:** `npm update @tanstack/react-query`

**Verification:** App loads, data fetching works (manual test)

---

### 1.3 Type Definitions
**Packages:** `@types/express` 5.0.5→5.0.6, `@types/lodash` 4.17.20→4.17.21, `@types/node` 24.9.2→24.10.3

**Research:** Type-only changes, no runtime impact.

**Upgrade:** `npm update @types/express @types/lodash @types/node`

**Verification:** `npm run build` succeeds

---

### 1.4 Build Tools (Minor)
**Packages:** `autoprefixer` 10.4.20→10.4.22, `postcss` 8.5.3→8.5.6, `tsx` 4.20.6→4.21.0, `drizzle-kit` 0.31.6→0.31.8

**Research:** Minor/patch releases.

**Upgrade:** `npm update autoprefixer postcss tsx drizzle-kit`

**Verification:** `npm run build` succeeds, dev server starts

---

### 1.5 Runtime Dependencies (Minor)
**Packages:** `better-sqlite3` 12.4.1→12.5.0, `express` 5.1.0→5.2.1, `jspdf` 3.0.3→3.0.4, `react-hook-form` 7.54.2→7.68.0, `react-markdown` 10.0.1→10.1.0, `react-router` 7.2.0→7.10.1, `react-simple-wysiwyg` 3.2.0→3.4.1

**Research:**
- `better-sqlite3` 12.5.0 - check changelog for native binding changes
- `express` 5.2.1 - still v5, minor improvements
- `react-router` 7.2→7.10 - significant minor bump, review migration notes

**Upgrade:** `npm update better-sqlite3 express jspdf react-hook-form react-markdown react-router react-simple-wysiwyg`

**Verification:**
- App starts without errors
- Routing works (navigate between pages)
- Forms submit correctly
- PDF export works (manual test)

---

### 1.6 Dev Tools
**Package:** `knip` 5.66.4→5.73.4

**Research:** Dev-only tool, low risk.

**Upgrade:** `npm update knip`

**Verification:** `npm run knip` runs without errors

---

## Phase 2: Radix UI Components

**Packages:** All `@radix-ui/react-*` packages

**Research:** Radix follows semver, minor bumps typically add features. Review changelog for any deprecations.

**Upgrade:**
```bash
npm update @radix-ui/react-alert-dialog @radix-ui/react-collapsible @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-popover @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-tooltip
```

**Verification:**
- UI components render correctly
- Dialogs open/close
- Dropdowns function
- Tooltips appear
- Manual smoke test of major UI flows

---

## Phase 3: Moderate Risk Updates

### 3.1 Lucide React Icons
**Package:** `lucide-react` 0.441.0→0.561.0

**Research:** Check if any icons used in codebase were renamed/removed. Common breaking change pattern.

**Remediation:** May need to update icon imports if names changed.

**Upgrade:** `npm install lucide-react@0.561.0`

**Verification:** `npm run build` succeeds, spot-check icons render

---

### 3.2 Globals (ESLint)
**Package:** `globals` 15.15.0→16.5.0

**Research:** Check changelog for breaking changes in global definitions.

**Upgrade:** `npm install globals@16.5.0`

**Verification:** `npm run lint` passes

---

### 3.3 TypeScript ESLint
**Package:** `@typescript-eslint/eslint-plugin` 8.46.3→8.49.0

**Research:** Minor version bump, may add new rules or deprecate old ones.

**Upgrade:** `npm install @typescript-eslint/eslint-plugin@8.49.0`

**Verification:** `npm run lint` passes

---

### 3.4 Vite Plugin React
**Package:** `@vitejs/plugin-react` 4.3.4→5.1.2

**Research:** Major version bump. Check migration guide for Vite 6 compatibility.

**Remediation:** May need vite.config.ts changes.

**Upgrade:** `npm install @vitejs/plugin-react@5.1.2`

**Verification:** `npm run dev:client` starts, HMR works

---

### 3.5 Vitest
**Package:** `vitest` 4.0.7→4.0.15

**Research:** Patch release.

**Upgrade:** `npm update vitest`

**Verification:** Tests pass (if any exist)

---

## Phase 4: Major Breaking Changes

### 4.1 React 19
**Packages:** `react` 18.3.1→19.2.3, `react-dom` 18.3.1→19.2.3, `@types/react` 18.3.18→19.2.7, `@types/react-dom` 18.3.5→19.2.3

**Research:**
- Review React 19 migration guide
- Check for deprecated APIs: `defaultProps`, `propTypes`, string refs
- `useEffect` timing changes
- Automatic batching changes
- New `use` hook

**Remediation:**
- Update any `forwardRef` patterns if needed
- Check Lexical compatibility with React 19
- Update any class components (if any)

**Upgrade:**
```bash
npm install react@19.2.3 react-dom@19.2.3 @types/react@19.2.7 @types/react-dom@19.2.3
```

**Verification:**
- App builds without errors
- App starts and renders
- All major features work (editor, brainstorm, lorebook)
- No console warnings about deprecated APIs

---

### 4.2 Zod 4
**Package:** `zod` 3.24.2→4.1.13

**Research:**
- Review Zod 4 migration guide
- Breaking: `z.object().strict()` behaviour
- Breaking: Error message format changes
- Breaking: `z.enum` changes

**Remediation:**
- Search codebase for Zod usage patterns
- Update schema definitions if needed
- Update error handling if relying on specific error shapes

**Upgrade:** `npm install zod@4.1.13`

**Verification:**
- Build succeeds
- Form validation works
- API validation works
- All Zod schemas function correctly

---

### 4.3 Drizzle ORM
**Package:** `drizzle-orm` 0.44.7→0.45.1

**Research:**
- Check changelog for breaking changes
- Query builder changes
- Migration compatibility

**Upgrade:** `npm install drizzle-orm@0.45.1`

**Verification:**
- Database operations work
- Migrations run successfully
- CRUD operations function

---

### 4.4 OpenAI SDK 6
**Package:** `openai` 4.86.1→6.10.0

**Research:**
- Major version jump (4→6, skipping 5)
- Review migration guide
- Streaming API changes
- Client instantiation changes
- Response type changes

**Remediation:**
- Update `AIService.ts` and provider classes
- Update streaming response handling
- Update type imports
- Test all three providers (OpenAI, OpenRouter, Local)

**Upgrade:** `npm install openai@6.10.0`

**Verification:**
- AI settings page loads
- Model fetching works for all providers
- Text generation works
- Streaming works correctly
- Abort functionality works

---

### 4.5 GPT Tokenizer 3
**Package:** `gpt-tokenizer` 2.9.0→3.4.0

**Research:**
- Check for API changes
- Token counting accuracy
- Model support changes

**Remediation:** Update tokenizer calls if API changed.

**Upgrade:** `npm install gpt-tokenizer@3.4.0`

**Verification:** Token counting displays correctly in editor

---

### 4.6 Tailwind CSS 4
**Package:** `tailwindcss` 3.4.17→4.1.18

**Research:**
- Major rewrite with new engine
- Config file changes (CSS-based config)
- Class name changes
- Plugin compatibility
- PostCSS integration changes

**Remediation:**
- Migrate `tailwind.config.js` to new format
- Update any deprecated utilities
- Check custom theme values
- Update PostCSS config if needed
- May need `@tailwindcss/postcss` package

**Upgrade:**
```bash
npm install tailwindcss@4.1.18
# Possibly: npm install @tailwindcss/postcss
```

**Verification:**
- Build succeeds
- All styles render correctly
- Dark mode works
- Custom colours/spacing work
- No visual regressions

---

### 4.7 Tailwind Merge 3
**Package:** `tailwind-merge` 2.6.0→3.4.0

**Research:**
- Check for API changes
- Tailwind 4 compatibility

**Remediation:** Update `cn()` utility if needed.

**Upgrade:** `npm install tailwind-merge@3.4.0`

**Verification:** Class merging works correctly, no style conflicts

---

### 4.8 Vite 7
**Package:** `vite` 6.4.1→7.2.7

**Research:**
- Review Vite 7 migration guide
- Config changes
- Plugin compatibility
- Build output changes

**Remediation:**
- Update `vite.config.ts`
- Check plugin compatibility
- Update any Vite-specific imports

**Upgrade:** `npm install vite@7.2.7`

**Verification:**
- Dev server starts
- HMR works
- Production build succeeds
- Built app runs correctly

---

### 4.9 Y-WebSocket 3
**Package:** `y-websocket` 2.1.0→3.0.0

**Research:**
- Check for API changes
- Yjs compatibility
- WebSocket connection handling

**Remediation:** Update Yjs integration if API changed.

**Upgrade:** `npm install y-websocket@3.0.0`

**Verification:** Collaborative features work (if used)

---

### 4.10 Lexical 0.39
**Packages:** `lexical` 0.24.0→0.39.0, all `@lexical/*` packages

**Research:**
- **HIGH RISK** - Custom Lexical implementation in `src/Lexical/`
- Review all changelogs from 0.24 to 0.39
- Node API changes
- Plugin API changes
- Selection API changes
- Custom node compatibility

**Remediation:**
- Update custom nodes (SceneBeatNode, etc.)
- Update plugins (LorebookTagPlugin, etc.)
- Update any deprecated APIs
- Test editor state serialisation/deserialisation

**Upgrade:**
```bash
npm install lexical@0.39.0 @lexical/code@0.39.0 @lexical/hashtag@0.39.0 @lexical/link@0.39.0 @lexical/list@0.39.0 @lexical/markdown@0.39.0 @lexical/overflow@0.39.0 @lexical/react@0.39.0 @lexical/rich-text@0.39.0 @lexical/table@0.39.0
```

**Verification:**
- Editor loads existing content
- Typing works
- Scene beats work (Alt+S)
- Lorebook tags work (@mentions)
- Copy/paste works
- Undo/redo works
- Word count updates
- Content saves correctly
- No data loss on existing chapters

---

## Execution Order

Recommended sequence to minimise risk and allow incremental verification:

1. **Phase 1** (Safe) - All at once, verify with build + lint
2. **Phase 2** (Radix) - All at once, manual UI smoke test
3. **Phase 3.1-3.3** (Lucide, Globals, TS-ESLint) - Build + lint verification
4. **Phase 4.1** (React 19) - Full app test before proceeding
5. **Phase 4.2-4.3** (Zod, Drizzle) - Database/validation test
6. **Phase 4.4-4.5** (OpenAI, GPT-Tokenizer) - AI feature test
7. **Phase 3.4-3.5, 4.8** (Vite ecosystem) - Build tool test
8. **Phase 4.6-4.7** (Tailwind ecosystem) - Visual regression check
9. **Phase 4.9** (Y-WebSocket) - If collaborative features used
10. **Phase 4.10** (Lexical) - **Last, most risky** - Full editor test

---

## Rollback Strategy

Before starting:
1. Ensure clean git state
2. Create branch: `git checkout -b dependency-upgrades`
3. Commit after each successful phase
4. If phase fails, `git checkout -- package.json package-lock.json && npm install`

---

## Notes

- Run `npm run build` after each phase to catch type errors early
- Keep browser console open during manual testing for runtime errors
- Document any remediation steps taken for future reference
