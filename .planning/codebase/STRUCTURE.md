# Codebase Structure

**Analysis Date:** 2026-01-23

## Directory Layout

```
TheStoryNexus/
├── server/                          # Express.js backend
│   ├── index.ts                     # Entry point, middleware setup, route mounting
│   ├── db/                          # Database layer
│   │   ├── schema.ts                # Drizzle ORM table definitions
│   │   ├── client.ts                # SQLite connection and Drizzle instance
│   │   ├── migrate.ts               # Migration runner
│   │   ├── seedSystemPrompts.ts     # System prompt initialization
│   │   └── migrations/              # Generated migration files
│   ├── lib/
│   │   └── crud.ts                  # Generic CRUD router factory
│   ├── routes/                      # API endpoint handlers
│   │   ├── stories.ts               # Story CRUD + export/import
│   │   ├── chapters.ts              # Chapter CRUD
│   │   ├── series.ts                # Series CRUD
│   │   ├── lorebook.ts              # Lorebook entry CRUD
│   │   ├── prompts.ts               # Prompt CRUD + system prompts
│   │   ├── ai.ts                    # AI settings endpoints
│   │   ├── brainstorm.ts            # AI chat endpoints
│   │   ├── scenebeats.ts            # Scene beat CRUD
│   │   ├── notes.ts                 # Note CRUD
│   │   └── admin.ts                 # Export/import database endpoints
│   └── services/
│       ├── epubGenerator.ts         # EPUB export utility
│       └── pdfGenerator.ts          # PDF export utility
│
├── src/                             # React frontend
│   ├── main.tsx                     # Entry point, provider setup, routing
│   ├── index.css                    # Global styles
│   ├── App.tsx                      # [REMOVED - routing in main.tsx now]
│   │
│   ├── components/                  # Shared UI components
│   │   ├── ErrorBoundary.tsx        # Global error boundary
│   │   ├── MainLayout.tsx           # Layout with icon nav
│   │   ├── ThemeToggle.tsx          # Theme switcher
│   │   ├── ui/                      # shadcn/ui components (Button, Dialog, etc.)
│   │   ├── workspace/               # Workspace shell (Sidebar, TopBar, MainContent)
│   │   │   ├── Workspace.tsx        # Main layout wrapper
│   │   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   │   ├── TopBar.tsx           # Header with search
│   │   │   ├── MainContent.tsx      # Feature routing
│   │   │   ├── CommandPalette.tsx   # Command palette dialog
│   │   │   ├── context/             # Workspace state (WorkspaceContext)
│   │   │   └── hooks/               # Workspace hooks (useWorkspaceShortcuts)
│   │   └── story-editor/            # Lexical rich text editor (103 files)
│   │       ├── Editor.tsx           # Main editor component
│   │       ├── EmbeddedPlayground.tsx # Lexical editor wrapper
│   │       ├── plugins/             # Custom Lexical plugins
│   │       │   ├── SaveChapterContent.ts # Auto-save to database
│   │       │   ├── LoadChapterContent.ts # Auto-load from database
│   │       │   ├── SceneBeatShortcutPlugin.ts # Alt+S trigger
│   │       │   ├── LorebookTagPlugin.ts # @tag autocomplete
│   │       │   ├── WordCountPlugin.ts # Word count tracking
│   │       │   ├── ToolbarPlugin.tsx # Text formatting toolbar
│   │       │   └── [20+ other plugins]
│   │       ├── nodes/               # Custom Lexical nodes
│   │       │   ├── SceneBeatNode.ts # Inline scene beat
│   │       │   ├── PageBreakNode/   # Page break representation
│   │       │   └── [image/layout nodes]
│   │       ├── context/             # Editor state (Settings, History, Toolbar)
│   │       └── shared/              # Utilities for editor
│   │
│   ├── features/                    # Feature modules (domain-driven)
│   │   ├── stories/                 # Story management
│   │   │   ├── hooks/               # useStoriesQuery, useCreateStoryMutation
│   │   │   ├── pages/               # StoryReader.tsx
│   │   │   ├── components/          # CreateStoryDialog, EditStoryDialog
│   │   │   └── context/             # StoryContext (current story)
│   │   │
│   │   ├── chapters/                # Chapter editing
│   │   │   ├── hooks/               # useChaptersQuery, useChapterQuery
│   │   │   ├── components/          # Chapter-specific UI
│   │   │   └── stores/              # Chapter state management
│   │   │
│   │   ├── series/                  # Series grouping
│   │   │   ├── hooks/               # useSeriesQuery
│   │   │   ├── pages/               # SeriesListPage
│   │   │   └── components/          # Series dialogs
│   │   │
│   │   ├── lorebook/                # Story context entries
│   │   │   ├── hooks/               # useLorebookQuery
│   │   │   ├── pages/               # LorebookPage
│   │   │   ├── components/          # Entry forms, browser UI
│   │   │   ├── context/             # Lorebook state
│   │   │   ├── stores/              # Category filtering state
│   │   │   └── utils/               # Matching, filtering
│   │   │
│   │   ├── prompts/                 # AI prompt management
│   │   │   ├── hooks/               # usePromptsQuery
│   │   │   ├── pages/               # PromptManager page
│   │   │   ├── components/          # Prompt editor, import/export
│   │   │   ├── services/            # promptParser.ts (template substitution)
│   │   │   └── utils/               # Prompt utilities
│   │   │
│   │   ├── brainstorm/              # AI chat interface
│   │   │   ├── hooks/               # useBrainstormQuery
│   │   │   ├── components/          # Chat UI, message display
│   │   │   └── pages/               # Brainstorm page
│   │   │
│   │   ├── scenebeats/              # Scene beat system
│   │   │   ├── hooks/               # useSceneBeatQuery
│   │   │   ├── components/          # Scene beat node rendering
│   │   │   ├── services/            # Scene beat business logic
│   │   │   └── stores/              # Scene beat state
│   │   │
│   │   ├── notes/                   # Story notes
│   │   │   ├── hooks/               # useNotesQuery
│   │   │   ├── components/          # Note editor
│   │   │   └── pages/               # Notes page
│   │   │
│   │   ├── ai/                      # AI provider settings
│   │   │   ├── hooks/               # useAISettings
│   │   │   ├── pages/               # SettingsPage
│   │   │   ├── components/          # Key input, model selector
│   │   │   ├── services/            # Provider-specific setup
│   │   │   └── types/               # AI-specific types
│   │   │
│   │   └── guide/                   # In-app user guide
│   │       ├── pages/               # GuidePage
│   │       ├── components/          # MDX components
│   │       └── content/             # Guide markdown files
│   │
│   ├── services/                    # Core services
│   │   ├── ai/                      # AI integration
│   │   │   ├── AIService.ts         # Singleton provider manager
│   │   │   ├── AIProviderFactory.ts # Provider instantiation
│   │   │   ├── streamUtils.ts       # Stream processing utilities
│   │   │   └── providers/           # Provider-specific implementations
│   │   │
│   │   ├── api/                     # API client
│   │   │   ├── client.ts            # Domain API objects (storiesApi, etc.)
│   │   │   └── apiFactory.ts        # Fetch wrapper and utilities
│   │   │
│   │   └── export/                  # Export utilities
│   │       ├── epubExporter.ts      # EPUB generation
│   │       ├── pdfExporter.ts       # PDF generation
│   │       └── [export utilities]
│   │
│   ├── lib/                         # Utility library
│   │   ├── theme-provider.tsx       # Dark/light theme context
│   │   └── utils.ts                 # classname utilities
│   │
│   ├── utils/                       # Helper functions
│   │   ├── logger.ts                # Logging wrapper
│   │   ├── lexicalUtils.ts          # Lexical editor helpers
│   │   ├── stringUtils.ts           # String manipulation
│   │   ├── textUtils.ts             # Text analysis (word count)
│   │   ├── toastUtils.ts            # Toast notification helpers
│   │   └── crypto.ts                # Encryption/hashing
│   │
│   ├── providers/                   # Global React providers
│   │   └── QueryProvider.tsx        # TanStack Query initialization
│   │
│   ├── types/                       # TypeScript definitions
│   │   ├── story.ts                 # All story-related types
│   │   └── global.d.ts              # Global type definitions
│   │
│   ├── schemas/                     # Zod validation schemas
│   │   └── entities.ts              # Story entity schemas
│   │
│   ├── constants/                   # Application constants
│   │   └── urls.ts                  # API base URLs
│   │
│   ├── data/                        # Demo/seed data
│   │   └── demoData.ts              # Sample stories for demo mode
│   │
│   └── assets/                      # Static assets
│
├── public/                          # Public static files
│   └── icons/                       # App icons and favicons
│
├── dist/                            # Production builds
│   ├── client/                      # Frontend build output (Vite)
│   └── server/                      # Backend build output (TypeScript)
│
├── data/                            # SQLite database file
│   └── storynexus.db                # Local SQLite database (created at runtime)
│
├── docs/                            # Documentation
│   └── archived/                    # Old design docs
│
├── .planning/                       # GSD planning documents
│   └── codebase/                    # Architecture/structure analysis
│
├── vite.config.ts                   # Vite build config (frontend)
├── tsconfig.json                    # TypeScript config (frontend)
├── server/tsconfig.json             # TypeScript config (backend)
├── package.json                     # Project dependencies
├── tailwind.config.js               # Tailwind CSS config
├── postcss.config.js                # PostCSS config
└── CLAUDE.md                        # Claude development instructions
```

## Directory Purposes

**server/:**
- Purpose: Express.js REST API backend
- Contains: Route handlers, database client, migrations, utility services
- Key files: `index.ts` (entry), `db/schema.ts` (ORM definitions), `routes/*.ts` (endpoints)

**src/main.tsx:**
- Purpose: React application entry point
- Contains: Router setup, provider initialization, root component rendering
- Key providers: ErrorBoundary, QueryProvider, ThemeProvider, StoryProvider

**src/components/:**
- Purpose: Shared, reusable UI components
- Contains: shadcn/ui components, error boundary, main layout, workspace shell, Lexical editor
- Key subdirectory: `story-editor/` contains 103 files for rich text editing

**src/features/:**
- Purpose: Feature modules organized by domain
- Contains: Stories, chapters, series, lorebook, prompts, brainstorm, notes, AI settings, guide
- Pattern: Each feature has hooks/ (TanStack Query), pages/, components/, sometimes services/

**src/services/:**
- Purpose: Core application logic and external integrations
- Contains: AIService singleton, API client factory, export utilities
- Key file: `ai/AIService.ts` manages multiple AI providers

**src/lib/ and src/utils/:**
- Purpose: Utility functions and helpers
- Contains: Logger, text utilities, lexical helpers, string manipulation, toast helpers
- Not feature-specific; shared across application

**server/db/:**
- Purpose: Database layer
- Contains: Drizzle ORM schema, SQLite connection, migrations, seed data
- Key file: `schema.ts` defines all 12 tables

## Key File Locations

**Entry Points:**
- Frontend: `src/main.tsx` - React root, routing, providers
- Backend: `server/index.ts` - Express setup, middleware, route mounting
- Editor: `src/components/story-editor/Editor.tsx` - Lexical editor component

**Configuration:**
- Frontend build: `vite.config.ts` - Vite plugins, aliases, server proxy
- Frontend types: `tsconfig.json` - Path aliases, strict checks
- Backend types: `server/tsconfig.json` - Separate TypeScript config
- Database: `server/db/client.ts` - SQLite connection setup
- Dependencies: `package.json` - All npm packages and scripts

**Core Logic:**
- AI Integration: `src/services/ai/AIService.ts` - Singleton provider manager
- API Client: `src/services/api/client.ts` - Type-safe fetch wrapper
- Database Schema: `server/db/schema.ts` - Drizzle ORM definitions
- CRUD Router: `server/lib/crud.ts` - Generic route generator
- Prompt Parser: `src/features/prompts/services/promptParser.ts` - Template substitution

**API Routes:**
- Stories: `server/routes/stories.ts` - Story CRUD, export/import
- Chapters: `server/routes/chapters.ts` - Chapter operations
- Lorebook: `server/routes/lorebook.ts` - Entry management, hierarchical queries
- Prompts: `server/routes/prompts.ts` - Prompt management, system prompts
- AI: `server/routes/ai.ts` - Settings and key management
- Brainstorm: `server/routes/brainstorm.ts` - AI chat storage
- Admin: `server/routes/admin.ts` - Database export/import, demo data

**Testing:**
- Not detected - no test files found (quality concerns)

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `CreateStoryDialog.tsx`, `Workspace.tsx`)
- Utilities: camelCase (e.g., `logger.ts`, `promptParser.ts`)
- Services: PascalCase + "Service" (e.g., `AIService.ts`)
- Hooks: camelCase with "use" prefix (e.g., `useStoriesQuery.ts`)
- Types: camelCase (e.g., `story.ts`, `global.d.ts`)
- Routes: camelCase (e.g., `stories.ts`, `lorebook.ts`)

**Directories:**
- Feature modules: lowercase (e.g., `stories/`, `chapters/`, `lorebook/`)
- Shared: lowercase (e.g., `components/`, `services/`, `lib/`, `utils/`)
- Subdivisions: functional purpose (e.g., `hooks/`, `components/`, `pages/`, `services/`)

**Variables & Functions:**
- camelCase throughout (enforced by ESLint)
- Constants: UPPER_CASE or PascalCase (e.g., `DEFAULT_LOCAL_API_URL`, `API_URLS`)
- Type names: PascalCase (e.g., `Story`, `Chapter`, `LorebookEntry`)

**Database:**
- Tables: singular lowercase (e.g., `stories`, `chapters`, `lorebookEntries`)
- Columns: camelCase (e.g., `storyId`, `povCharacter`, `createdAt`)
- IDs: text type with nanoid (e.g., `id: text().primaryKey()`)
- Timestamps: millisecond-precision `integer(..., { mode: "timestamp" })`

## Where to Add New Code

**New Feature:**
- Primary code: `src/features/{featureName}/` with subdirs: `hooks/`, `pages/`, `components/`
- Backend: `server/routes/{featureName}.ts` with standard CRUD or custom routes
- Database: Add table to `server/db/schema.ts`, run `npm run db:generate` to create migration
- API client: Add domain API object to `src/services/api/client.ts`
- Tests: Create `src/features/{featureName}/__tests__/` (if test structure added)

**New Component/Module:**
- Shared component: `src/components/{name}.tsx`
- Feature-specific component: `src/features/{featureName}/components/{name}.tsx`
- Custom hook: `src/features/{featureName}/hooks/use{Name}.ts`
- Service logic: `src/features/{featureName}/services/{name}.ts`

**Utilities:**
- Shared helpers: `src/utils/{purpose}.ts`
- Library functions: `src/lib/{purpose}.ts`
- Backend utilities: `server/services/{purpose}.ts` or `server/lib/{purpose}.ts`

**Styling:**
- Global: `src/index.css` (Tailwind imports and root styles)
- Component: Inline Tailwind classes in JSX (`className="...")
- UI library: shadcn/ui components in `src/components/ui/` (auto-generated)

**Types:**
- Global story types: `src/types/story.ts`
- Feature-specific types: `src/features/{featureName}/types/{name}.ts`
- Global types: `src/types/global.d.ts`

## Special Directories

**src/Lexical/:**
- Purpose: Custom Lexical editor implementation
- Generated: No, source code
- Committed: Yes
- Contains: Modified Lexical playground with custom nodes and plugins
- Location: `src/Lexical/lexical-playground/` and `src/Lexical/shared/`
- Not to be deleted; core to editor functionality

**dist/:**
- Purpose: Production build output
- Generated: Yes (from `npm run build`)
- Committed: No (gitignored)
- Frontend output: `dist/client/` (Vite build)
- Backend output: `dist/server/` (TypeScript compilation)
- Runtime: `npm start` serves from `dist/client/` as static files

**data/:**
- Purpose: SQLite database storage
- Generated: Yes (created at runtime if missing)
- Committed: No (gitignored)
- Default path: `data/storynexus.db`
- Configurable: `DATABASE_PATH` env var

**server/db/migrations/:**
- Purpose: Generated Drizzle migrations
- Generated: Yes (from `npm run db:generate`)
- Committed: Yes (version control for schema)
- Created when: Schema in `schema.ts` changes
- Applied when: Backend starts (auto-run via `runMigrations()`)

**public/:**
- Purpose: Static assets served in development and embedded in production
- Generated: No
- Committed: Yes
- Contains: Icons, favicons, static images
- Access: Direct URL in development, embedded by Vite in production

---

*Structure analysis: 2026-01-23*
