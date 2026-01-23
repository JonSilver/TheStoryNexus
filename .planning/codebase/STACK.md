# Technology Stack

**Analysis Date:** 2026-01-23

## Languages

**Primary:**
- TypeScript 5.9 - Full codebase (frontend + backend)

**Secondary:**
- JavaScript (ES2020+) - Configuration files and bundler

## Runtime

**Environment:**
- Node.js 22 (Alpine) - Production Docker image
- Browser (ES2020+) - Frontend React application

**Package Manager:**
- npm - Project dependency management
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core Backend:**
- Express.js v5.1 - HTTP API server, port 3001 (dev) / 3000 (prod)

**Core Frontend:**
- React 19.2 - UI framework with React DOM 19.2
- Vite 7.2 - Build tool with HMR, dev server on port 5173

**Routing:**
- React Router v7.1 - Client-side SPA routing
- Express.js built-in routing - API endpoint organization

**Forms & State:**
- React Hook Form v7.54 - Form handling and validation
- TanStack Query v5.90 - Server state management, caching, synchronization

**Editor:**
- Lexical v0.39 - Rich text editor (custom playground in `src/Lexical/lexical-playground/`)
  - Lexical plugins: `@lexical/code`, `@lexical/hashtag`, `@lexical/link`, `@lexical/list`, `@lexical/markdown`, `@lexical/overflow`, `@lexical/react`, `@lexical/rich-text`, `@lexical/table`
  - Custom nodes: SceneBeatNode, LorebookTagPlugin, SaveChapterContent, LoadChapterContent, WordCountPlugin

**Database:**
- SQLite - Embedded database, WAL mode enabled
- Drizzle ORM v0.45 - Type-safe database queries
- better-sqlite3 v12.4 - Native SQLite driver

**UI Components:**
- Radix UI (Headless primitives) - Accessible component base
  - Components: Alert Dialog, Collapsible, Dialog, Dropdown Menu, Label, Menubar, Popover, Scroll Area, Select, Separator, Slider, Switch, Tabs, Tooltip
- Shadcn UI - Component library built on Radix
- Tailwind CSS v3.4 - Utility-first styling
- Lucide React v0.561 - Icon library
- React Toastify v11.0 - Toast notifications
- Vaul v1.1 - Drawer/sidebar component

**Drag & Drop:**
- @dnd-kit/core v6.3, @dnd-kit/sortable v10.0, @dnd-kit/utilities v3.2 - Drag and drop functionality

**Content Processing:**
- React Markdown v10.0 - Markdown rendering
- remark-gfm v4.0 - GitHub Flavored Markdown support
- remark-github-blockquote-alert v2.0 - Alert/note block syntax
- rehype-raw v7.0 - HTML pass-through
- rehype-sanitize v6.0 - HTML sanitization
- @mdx-js/rollup v3.1 - MDX processing

**AI Integration:**
- OpenAI SDK v6.10 - OpenAI API client
- @google/genai v1.34 - Google Gemini API client
- gpt-tokenizer v3.4 - Token counting for prompt sizing

**Data Export:**
- jspdf v3.0 - PDF generation
- epub-gen-memory v1.1 - EPUB generation

**Validation & Errors:**
- Zod v4.1 - Schema validation and type inference
- @jfdi/attempt v1.3 - Functional error handling (try-catch alternative)
- react-error-boundary v6.0 - React error boundaries

**HTTP & Requests:**
- CORS v2.8 - Cross-origin resource sharing middleware (development)
- Multer v2.0 - File upload handling

**File Uploads:**
- Multer v2.0 - Express middleware for multipart/form-data

**Real-time Collaboration:**
- Yjs v13.6 - Shared state library
- y-websocket v3.0 - WebSocket provider for Yjs

**Utilities:**
- lodash v4.17 - Utility functions
- nanoid v5.1 - Unique ID generation
- loglevel v1.9 - Logging with levels

**Hotkeys:**
- react-hotkeys-hook v5.2 - Keyboard shortcut handling

**Development Tools:**
- OxLint v1.33 - Fast JavaScript/TypeScript linter (replaces ESLint)
- Prettier v3.7 - Code formatter with import sorting plugin
  - @trivago/prettier-plugin-sort-imports v6.0
- Knip v5.66 - Unused files/exports/dependencies detector
- tsx v4.20 - TypeScript executor for Node.js
- concurrently v9.2 - Run multiple npm scripts in parallel
- cross-env v10.1 - Environment variable management
- Drizzle Kit v0.31 - Database migration generation and execution

**CSS Processing:**
- Tailwind CSS v3.4 - Utility CSS
- autoprefixer v10.4 - PostCSS vendor prefixes
- tailwindcss-animate v1.0 - Animation utilities
- tailwind-merge v3.4 - Tailwind class resolution
- class-variance-authority v0.7 - Component variant pattern
- clsx v2.1 - Conditional className utility
- postcss v8.5 - CSS transformation pipeline

## Key Dependencies

**Critical:**
- `better-sqlite3` v12.4 - Native SQLite driver, required for local data persistence
- `drizzle-orm` v0.45 - Type-safe ORM, foundational to database layer
- `@tanstack/react-query` v5.90 - Server state management, critical for data synchronization
- `express` v5.1 - HTTP server, essential backend framework
- `react` v19.2 - UI rendering
- `lexical` v0.39 - Rich text editor, core to story writing interface
- `zod` v4.1 - Runtime type validation

**Infrastructure:**
- `openai` v6.10 - OpenAI API integration
- `@google/genai` v1.34 - Google Gemini integration
- `multer` v2.0 - File upload handling for import/export
- `cors` v2.8 - CORS middleware (development only)
- `yjs` / `y-websocket` v3.0 - Real-time collaboration support

**TypeScript Support:**
- `@types/express` v5.0, `@types/react` v19.2, `@types/node` v25.0 - Type definitions

## Configuration

**Environment Variables:**
- `NODE_ENV` - Set to `development` (dev) or `production` (prod)
- `PORT` - Server port (default: 3000 production, 3001 dev)
- `DATABASE_PATH` - SQLite database file path (default: `./data/storynexus.db`)

**Build Configuration:**
- `vite.config.ts` - Frontend build setup
  - React plugin for `.jsx/.tsx/.mdx` files
  - Path aliases: `@/*` → `./src/*`, `shared/*` → `src/Lexical/shared/src/*`
  - Dev proxy: `/api` → `http://localhost:3001`
  - Output: `dist/client/`
- `server/tsconfig.json` - Backend TypeScript config
- `tsconfig.json` - Frontend TypeScript config (ES2020, strict null checks)
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS pipeline
- `drizzle.config.ts` - SQLite database and migration configuration
- `prettier.config.json` - Code formatting rules
- `.eslintrc` / OxLint config - Linting rules
- `knip.config.ts` - Unused code detection

**TypeScript Compiler:**
- Target: ES2020
- `strict: false` but enables: `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`
- Module resolution: `bundler`
- JSX: `react-jsx`

## Platform Requirements

**Development:**
- Node.js 22+
- npm 10+
- Port 3001 available (backend dev server)
- Port 5173 available (frontend dev server)
- SQLite database directory writable

**Production:**
- Node.js 22 (Alpine)
- Port 3000 (configurable via `PORT` env var)
- Persistent volume for SQLite database at `DATABASE_PATH`
- Docker (optional, Dockerfile provided for containerization)

**External API Keys (Optional):**
- OpenAI API key (for GPT models)
- Google Gemini API key
- OpenRouter API key
- Local AI API endpoint (defaults to `http://localhost:1234/v1` for LM Studio compatibility)

---

*Stack analysis: 2026-01-23*
