# Architecture

**Analysis Date:** 2026-01-23

## Pattern Overview

**Overall:** Server-driven SPA with feature-based frontend organization and domain-aligned backend routing

**Key Characteristics:**
- Decoupled frontend and backend running on separate ports (frontend: Vite on 5173, backend: Express on 3001)
- Frontend uses React Router for client-side routing with nested route structure
- Backend provides REST API endpoints organized by domain (stories, chapters, lorebook, etc.)
- TanStack Query handles all server state management and synchronization
- Singleton AIService manages multi-provider AI integration
- Lexical-based rich text editor with custom plugins for story-specific features

## Layers

**Presentation Layer:**
- Purpose: React components, routing, UI state, forms, user interactions
- Location: `src/` (components, features, lib, providers)
- Contains: Page components, feature components, utility components, context/hooks, forms
- Depends on: Services (API client, AI service, export utilities), Providers (Query, Theme)
- Used by: Browser, Workspace shell

**Service Layer:**
- Purpose: Business logic, external service integration, data transformation
- Location: `src/services/` and `src/features/*/services/`
- Contains: AI integration (`AIService.ts`), API client factory, export utilities (PDF/EPUB), prompt parsing
- Depends on: Type definitions, external libraries (OpenAI, Google GenAI, Drizzle)
- Used by: Components, hooks, routes

**API Layer:**
- Purpose: HTTP endpoints, request handling, database operations
- Location: `server/routes/` and `server/lib/crud.ts`
- Contains: CRUD route generators, domain-specific routes (stories, chapters, lorebook, etc.), file upload handlers
- Depends on: Database client, Drizzle ORM, schema definitions
- Used by: Frontend via fetch/API client

**Persistence Layer:**
- Purpose: Data storage and retrieval
- Location: `server/db/`
- Contains: SQLite database with Drizzle ORM, schema definitions, migrations
- Depends on: better-sqlite3
- Used by: API routes via Drizzle query builder

**Data Access Hooks:**
- Purpose: TanStack Query hooks for frontend data fetching and mutations
- Location: `src/features/*/hooks/` (e.g., `useStoriesQuery`, `useChaptersQuery`)
- Contains: Query hooks with proper cache invalidation, mutation hooks with toast notifications
- Pattern: Each feature has corresponding hooks following TanStack Query conventions
- Used by: Page components and feature components

## Data Flow

**Story Creation Flow:**

1. User fills `CreateStoryDialog` component in Workspace
2. Component calls `useCreateStoryMutation()` hook
3. Hook calls `storiesApi.create()` via API client factory
4. Frontend sends POST request to `/api/stories`
5. Backend route handler in `server/routes/stories.ts` processes request
6. CRUD router creates entry via Drizzle ORM insert
7. SQLite database stores record
8. Response returned to frontend
9. TanStack Query invalidates `storiesKeys.all` cache
10. UI re-renders with new story

**Chapter Editing Flow:**

1. User opens chapter in Lexical editor
2. `LoadChapterContentPlugin` fetches chapter content on mount via `chaptersApi.getById()`
3. Lexical editor initializes with stored state JSON
4. User edits content
5. `SaveChapterContentPlugin` debounces changes and calls `chaptersApi.update()`
6. Frontend sends PUT request to `/api/chapters/:id`
7. Backend saves updated content field
8. On navigation, TanStack Query invalidates chapter cache automatically
9. Fresh chapter loaded on next view

**AI Generation Flow:**

1. User triggers generation (scene beat, continue writing, brainstorm)
2. Component calls `AIService.getInstance().generate()`
3. `AIService` determines provider type from model ID prefix (e.g., `openai/`, `gemini/`, `local/`)
4. Factory method routes to appropriate provider client (`generateWithOpenAI()`, `generateWithGemini()`, etc.)
5. Provider returns Response object (streaming)
6. Component calls `processStreamedResponse()` utility
7. Stream chunks received and accumulated
8. Token callback fires for UI updates (tokens, cost)
9. On completion, content inserted into editor or brainstorm chat
10. Cache invalidation updates relevant TanStack Query state

**State Management:**

- Server state (stories, chapters, prompts, lorebook): TanStack Query via hooks
- UI state (sidebar open, theme, command palette): React Context or local state
- Editor state: Lexical EditorState JSON (stored in database, restored on mount)
- AI service state: Singleton instance with initialized providers
- Global state: StoryProvider (current story context), ThemeProvider, QueryProvider

## Key Abstractions

**TanStack Query Pattern:**
- Purpose: Centralized server state management with automatic cache invalidation
- Examples: `src/features/stories/hooks/useStoriesQuery.ts`, `src/features/chapters/hooks/useChaptersQuery.ts`
- Pattern: Query keys factory, useQuery for reads, useMutation for writes, queryClient.invalidateQueries for cache
- Benefit: Automatic refetching, stale-while-revalidate, request deduplication

**CRUD Router Factory:**
- Purpose: Generic REST endpoint generation for database tables
- Location: `server/lib/crud.ts`
- Pattern: `createCrudRouter({ table, name, parentKey, customRoutes })` generates GET/POST/PUT/DELETE endpoints
- Benefit: Eliminates boilerplate route definitions for standard operations
- Custom routes extend factory (e.g., story export/import in `server/routes/stories.ts`)

**API Client Factory:**
- Purpose: Type-safe fetch wrapper with automatic JSON serialization
- Location: `src/services/api/client.ts` and `src/services/api/apiFactory.ts`
- Pattern: Domain-specific API objects (storiesApi, chaptersApi, lorebookApi) with methods for each operation
- Benefit: Single point of change for API URL changes, type-safe client definitions

**AIService Singleton:**
- Purpose: Unified multi-provider AI integration
- Location: `src/services/ai/AIService.ts`
- Pattern: Static getInstance(), provider factory pattern, model fetching and caching
- Abstraction: Providers (OpenAI, Gemini, OpenRouter, Local) behind unified interface
- Used by: Prompt system, scene beats, brainstorm chat, continue writing

**Prompt Parser & Substitution:**
- Purpose: Template variable substitution in prompts
- Location: `src/features/prompts/services/promptParser.ts`
- Pattern: Process `{{variable_name}}` syntax, support function calls
- Variables: lorebook entries, chapter content, selected text, POV, story language
- Categories: Different variable sets for scene beats, summaries, brainstorming

**Lexical Editor Integration:**
- Purpose: Custom rich text editing with story-specific capabilities
- Location: `src/components/story-editor/` (103 files)
- Plugins: Custom nodes (SceneBeatNode, PageBreakNode), auto-save, auto-load, word count
- Storage: EditorState JSON persisted in `chapters.content` field
- Validation: Content loaded via `LoadChapterContentPlugin` on component mount

**Lorebook Hierarchy:**
- Purpose: Multi-level scope system for story context
- Pattern: Three levels (global, series, story) with inheritance
- Categories: character, location, item, event, note, synopsis, timeline
- Matching: Auto-match against chapter/scene beat content for prompt context

## Entry Points

**Frontend Entry Point:**
- Location: `src/main.tsx`
- Triggers: App load in browser
- Responsibilities:
  - Initialize providers (QueryProvider, ThemeProvider, StoryProvider)
  - Set up routing (BrowserRouter, Routes)
  - Render root components (ErrorBoundary, Workspace, MainLayout)
  - Global state providers and wrappers

**Backend Entry Point:**
- Location: `server/index.ts`
- Triggers: `npm run dev:server` or `npm start`
- Responsibilities:
  - Configure Express middleware (CORS, JSON parsing)
  - Run database migrations and seed system prompts
  - Mount API routers (/api/stories, /api/chapters, etc.)
  - Serve static files in production (SPA routing fallback to index.html)
  - Global error handling middleware

**Workspace Component:**
- Location: `src/components/workspace/Workspace.tsx`
- Triggers: `/` route
- Responsibilities:
  - Top-level layout (sidebar, top bar, main content, command palette)
  - Navigation state management
  - Story/chapter selection and display
  - Feature routing (chapters, prompts, lorebook, brainstorm)

**Chapter Editor:**
- Location: `src/components/story-editor/` (embedded via EmbeddedPlayground)
- Triggers: Chapter edit action
- Responsibilities:
  - Lexical editor initialization with chapter content
  - Auto-save and auto-load of content
  - Word count tracking
  - Scene beat and lorebook tag integration

## Error Handling

**Strategy:** Functional error handling via `@jfdi/attempt` library with optional error boundaries for recovery

**Patterns:**

```typescript
// Synchronous: [error, result] = attempt(() => operation())
const [error, data] = attempt(() => JSON.parse(content));
if (error) return handleError(error);

// Asynchronous: [error, result] = await attemptPromise(async () => await op())
const [error, stories] = await attemptPromise(() => storiesApi.getAll());
if (error) {
    logger.error("Failed to fetch stories", error);
    throw error;
}

// In routes: CRUD router asyncHandler catches and responds 500
router.get("/:id", asyncHandler(async (req, res) => {
    // Error caught by wrapper, logs and sends 500 response
}));
```

- Only add error handling for likely recoverable errors
- Unhandled exceptions fall back to global ErrorBoundary (React) or Express error middleware
- API responses use standard { error, message } or { success, details } format
- Toast notifications for user-facing errors in mutations

## Cross-Cutting Concerns

**Logging:**
- `src/utils/logger.ts` wraps loglevel
- Used for AI service diagnostics, database operations, error tracking
- Pattern: `logger.info()`, `logger.error()` for structured logging

**Validation:**
- Frontend: React Hook Form for form validation
- Backend: Zod schemas in `src/schemas/` for runtime type checking
- Database: Drizzle schema enforces types and constraints

**Authentication:**
- Not implemented; assumes single-user local deployment
- File-based data storage with SQLite (no auth layer needed)

**CORS:**
- Enabled in development (`npm run dev` on different ports)
- Disabled in production (single server serving both frontend and API)

**Type Safety:**
- TypeScript with `strict: false` but specific strict checks enabled
- Path aliases: `@/*` → `src/*`, `shared/*` → `src/Lexical/shared/src/*`
- Type inference from database schema via Drizzle

---

*Architecture analysis: 2026-01-23*
