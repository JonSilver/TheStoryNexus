# Codebase Concerns

**Analysis Date:** 2026-01-23

## Tech Debt

**Debug Logging Left in Production Code:**
- Issue: `BrainstormResolvers.ts` contains extensive DEBUG-level logging that logs context data, chapter content fetches, and processing steps
- Files: `src/features/prompts/services/resolvers/BrainstormResolvers.ts` (lines 36, 86, 90, 95, 100, 105, 111, 115, 124, 129, 131-132)
- Impact: Performance overhead in production; verbose logging may expose sensitive content structure; clutters logs with noise
- Fix approach: Remove DEBUG logger calls or wrap in development-only conditional. Replace with targeted error/warning logs only

**Unresolved TypeScript Suppressions:**
- Issue: Multiple `@ts-expect-error` comments indicating unresolved type issues
- Files:
  - `src/components/story-editor/collaboration.ts` line 20: "TODO WTF!? Why expecting an error?!" - WebsocketProvider typing issue
  - `src/components/story-editor/plugins/ContextMenuPlugin/index.tsx` (2 instances): "These types are incorrect"
  - `src/components/story-editor/plugins/CollapsiblePlugin/CollapsibleUtils.ts`: HTML `hidden="until-found"` attribute not in TypeScript types
- Impact: Type safety degradation; masks real type errors; indicates underlying library compatibility issues
- Fix approach: Document why suppressions exist; upgrade libraries if possible; or use proper type overrides

**Unaddressed TODO Comments:**
- Issue: TODO items left in codebase without resolution tracking
- Files:
  - `src/components/story-editor/utils/url.ts` line 24: "Fix UI for link insertion; it should never default to an invalid URL such as https://"
  - `src/components/story-editor/plugins/MarkdownTransformers/index.ts` line 40: "Get rid of isImport flag"
  - `src/components/story-editor/nodes/InlineImageNode/InlineImageComponent.tsx` line 151: "This is just a temporary workaround for FF to behave like other browsers"
- Impact: Technical debt accumulates; browser compatibility issues may persist; UX friction remains
- Fix approach: Create issues for each TODO or implement fixes

**Suboptimal URL Validation:**
- Issue: `validateUrl()` in `src/components/story-editor/utils/url.ts` line 26 accepts `"https://"` as valid despite it being incomplete
- Files: `src/components/story-editor/utils/url.ts`
- Impact: Users can insert broken link placeholders into documents; bad UX when links are incomplete
- Fix approach: Return false for `"https://"` and prompt user to enter complete URL before insertion (per TODO at line 24)

## Known Bugs

**Firefox Drag & Drop Workaround:**
- Symptoms: Drag events don't behave consistently across browsers
- Files: `src/components/story-editor/nodes/InlineImageNode/InlineImageComponent.tsx` line 151
- Trigger: User attempts to drag image node in editor, particularly in Firefox
- Workaround: `event.preventDefault()` disables native drag behavior entirely, falling back to other drag systems
- Status: Temporary fix; proper browser-agnostic solution needed

**Link Insertion UI Defect:**
- Symptoms: Link insertion dialog defaults to invalid URL `"https://"`
- Files: `src/components/story-editor/utils/url.ts` line 24
- Trigger: User inserts link without typing URL
- Workaround: None; users must manually fix the URL post-insertion
- Status: Requires UI redesign per TODO

**Markdown Import Flag Complexity:**
- Symptoms: `isImport` flag in `MarkdownTransformers` adds complexity and conditional logic
- Files: `src/components/story-editor/plugins/MarkdownTransformers/index.ts` line 40
- Trigger: During markdown import, different behavior needed for horizontal rules
- Workaround: Current implementation checks `isImport` to decide node insertion strategy
- Status: TODO indicates desire for refactor

## Security Considerations

**CORS Disabled in Development:**
- Risk: Development server has unrestricted CORS (`app.use(cors())`) which opens to cross-origin requests
- Files: `server/index.ts` lines 43-44
- Current mitigation: Limited to development environment (`NODE_ENV === "development"`)
- Recommendations:
  - Add CORS allowlist for production (currently no production CORS handling)
  - Document that production needs explicit CORS configuration
  - Consider using environment variables for allowed origins

**No Input Validation on API Updates:**
- Risk: CRUD endpoints accept arbitrary request body fields and apply them directly to database updates
- Files: `server/lib/crud.ts` lines 115-117 (PUT endpoint), `server/routes/ai.ts` lines 38-50
- Current mitigation: Some field filtering (e.g., stripping `id` and `createdAt`) but not comprehensive
- Impact: Users could potentially modify unintended fields if API contract changes
- Recommendations:
  - Implement strict schema validation on all PATCH/PUT endpoints
  - Use Zod schemas to whitelist allowed update fields per entity
  - Validate all user input before database operations

**Local AI URL Not Validated:**
- Risk: `AIService` accepts arbitrary `localApiUrl` without validation
- Files: `src/services/ai/AIService.ts` lines 49-50, 238-241
- Current mitigation: None (accepts user input directly)
- Impact: SSRF potential if user provides arbitrary internal URLs; could be used to access internal services
- Recommendations:
  - Validate URL is valid http/https with proper hostname
  - Restrict to localhost/127.0.0.1 or whitelist known addresses
  - Consider URL allowlist for production deployments

**No Authentication/Authorization:**
- Risk: API endpoints have no authentication; any request reaching the server can read/write/delete data
- Files: All files in `server/routes/`
- Current mitigation: None; app is local-first and assumes single-user or trusted network
- Impact: High risk if deployed to untrusted networks; no per-user data isolation
- Recommendations:
  - Document that this is local-only/trusted-network software
  - If multi-user support needed, implement authentication (OAuth, API keys, JWT)
  - Implement per-story/per-series ownership checks

## Performance Bottlenecks

**Debounced Chapter Saves May Lose Recent Edits:**
- Problem: Chapter content saves debounced to 1000ms; rapid close/navigation could lose unsaved edits
- Files: `src/components/story-editor/plugins/SaveChapterContent/index.tsx` line 28
- Cause: 1-second debounce delay means edits within that window won't persist if user leaves immediately
- Improvement path:
  - Flush debounced save on window beforeunload
  - Show unsaved indicator to user
  - Add explicit "Save" button as fallback
  - Consider shorter debounce or immediate saves for critical changes

**Brainstorm Context Resolution Fetches All Chapters Eagerly:**
- Problem: `BrainstormContextResolver` fetches all chapter summaries unnecessarily
- Files: `src/features/prompts/services/resolvers/BrainstormResolvers.ts` line 39
- Cause: `fetchAllChapterSummaries()` called even when only specific chapters selected
- Improvement path:
  - Only fetch summaries for chapters included in context selection
  - Implement pagination/limiting for large stories with many chapters
  - Cache chapter summaries in memory

**No Result Pagination:**
- Problem: All API list endpoints return all results without pagination
- Files: `server/lib/crud.ts` lines 57-78 (GET all)
- Cause: Stories with 1000+ chapters would return entire dataset
- Improvement path:
  - Implement offset/limit pagination
  - Add cursor-based pagination for better UX
  - Set reasonable default limits (e.g., 50 items per page)

**Large Lexical Editor State Parsing:**
- Problem: Editor state stored as JSON string in database; entire chapter content JSON parsed on load
- Files: `src/components/story-editor/plugins/LoadChapterContent/index.tsx` line 28
- Cause: No lazy loading or streaming of editor state
- Improvement path:
  - Consider splitting large chapters into sections
  - Implement virtual scrolling for very long chapters
  - Profile actual impact on large documents (>100k words)

## Fragile Areas

**Lexical Editor State Serialization:**
- Files: `src/components/story-editor/plugins/SaveChapterContent/index.tsx`, `src/components/story-editor/plugins/LoadChapterContent/index.tsx`
- Why fragile: Editor state stored as `JSON.stringify(editorState.toJSON())`. Lexical version upgrades could break serialization format. No migration path for stale state.
- Safe modification:
  - Test editor state round-trip (save → load) after any Lexical dependency upgrade
  - Add version field to stored state
  - Implement state migration logic for version changes
  - Keep backup of working state before upgrades
- Test coverage: No visible tests for editor state persistence; critical gap

**AI Provider Factory Initialization:**
- Files: `src/services/ai/AIService.ts`, `src/services/ai/AIProviderFactory.ts`
- Why fragile: Providers initialized lazily; missing API keys throw errors at generation time, not init time
- Safe modification:
  - Validate all required keys exist before first use
  - Test each provider initialization separately
  - Add explicit error handling for uninitialized providers
- Test coverage: No visible tests for provider initialization sequence

**Chapter Order Assumptions:**
- Files: `server/db/schema.ts` line 49 (order field), all chapter queries
- Why fragile: No unique constraint on `(storyId, order)` pairs; could have duplicate orders
- Safe modification:
  - Add unique constraint to enforce order uniqueness per story
  - Implement reordering logic that handles gaps/duplicates
  - Add migration to fix existing duplicates
- Test coverage: No visible tests for chapter ordering edge cases

**Lorebook Hierarchy Matching:**
- Files: `src/features/prompts/services/resolvers/BrainstormResolvers.ts`, prompt resolution system
- Why fragile: Lorebook entries matched by global/series/story hierarchy; changes to hierarchy rules could silently include/exclude entries
- Safe modification:
  - Add debug logging for which entries matched and why
  - Test hierarchy rules exhaustively (global + series + story cases)
  - Document matching algorithm clearly
- Test coverage: No visible tests for lorebook matching logic

## Scaling Limits

**SQLite Single Writer Limitation:**
- Current capacity: SQLite allows one write at a time; concurrent save requests queue
- Limit: With many concurrent users (10+) on same story, writes will bottleneck
- Scaling path:
  - Migrate to PostgreSQL for multi-writer support
  - Implement operation transformation (OT) or CRDT for collaborative editing
  - Add write queue with conflict resolution

**Lexical Editor State Size:**
- Current capacity: Editor state serialized as JSON; tested informally up to ~100k words
- Limit: Very large documents (500k+ words) may have slow load/save cycles
- Scaling path:
  - Split chapters into sections stored separately
  - Implement lazy loading of section content
  - Consider alternative serialization format (binary)

**In-Memory AI Service Singleton:**
- Current capacity: One `AIService` instance holds all provider clients and settings
- Limit: Multiple concurrent generations could contend on stream handling
- Scaling path:
  - Use connection pooling for provider clients
  - Implement per-user/per-request service instances if multi-user
  - Add request queueing for concurrent generations

## Dependencies at Risk

**Lexical Version Lock:**
- Risk: Project pins `@lexical/*` at `^0.39.0`; major version upgrades may break serialization
- Impact: Editor state format could become incompatible; hard migrations needed
- Migration plan:
  - Monitor Lexical releases for breaking changes
  - Test state round-trip before upgrading
  - Implement state versioning if upgrading major versions
  - Consider vendoring critical Lexical code if needed

**OpenAI SDK API Changes:**
- Risk: `openai` dependency at `^6.10.0`; SDK updates could change method signatures
- Impact: Provider integration breaks silently if SDK interface changes
- Migration plan:
  - Test OpenAI generation after dependency upgrades
  - Pin to specific minor version if breaking changes frequent
  - Monitor OpenAI SDK changelog

**Google GenAI SDK Stability:**
- Risk: `@google/genai` at `^1.34.0`; newer service, potentially less stable than OpenAI
- Impact: Gemini provider could fail unexpectedly with SDK updates
- Migration plan:
  - Test Gemini generation regularly
  - Have fallback to OpenAI if Gemini unavailable
  - Monitor SDK release notes

## Test Coverage Gaps

**No Editor State Persistence Tests:**
- What's not tested: Entire Lexical save/load cycle; no tests for chapter content round-trip
- Files: `src/components/story-editor/plugins/SaveChapterContent/`, `src/components/story-editor/plugins/LoadChapterContent/`
- Risk: State corruption or loss undetected; browser updates could silently break persistence
- Priority: High (data loss risk)

**No AI Generation Error Handling Tests:**
- What's not tested: Provider failures, network errors, invalid API keys
- Files: `src/services/ai/AIService.ts`, provider implementations
- Risk: Error states propagate to UI ungracefully; users see raw errors
- Priority: High (user experience)

**No Lorebook Matching Tests:**
- What's not tested: Lorebook entry filtering logic, hierarchy resolution
- Files: `src/features/prompts/services/resolvers/`, prompt matching system
- Risk: Wrong entries injected into prompts; silent failures
- Priority: Medium (affects generation quality)

**No Concurrent Save Tests:**
- What's not tested: Multiple chapter saves, mutation race conditions
- Files: `src/components/story-editor/plugins/SaveChapterContent/`, TanStack Query mutations
- Risk: Data loss in concurrent edit scenarios; last-write-wins overwrites user changes
- Priority: Medium (multi-device usage)

**No CRUD Validation Tests:**
- What's not tested: API input validation, malformed request handling
- Files: `server/lib/crud.ts`, all route handlers
- Risk: Unexpected data in database; type assumptions fail at runtime
- Priority: Medium (data integrity)

---

*Concerns audit: 2026-01-23*
